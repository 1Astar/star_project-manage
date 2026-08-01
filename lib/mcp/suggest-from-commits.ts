import {
  getPoolBundle,
  getProjectBundle,
  getProjects,
} from "@/lib/db/local-store";
import { commitSubject, titlesSimilar } from "@/lib/mcp/title-match";
import {
  listGitSyncSuggestions,
  resolveGitSyncSuggestions,
  upsertGitSyncSuggestions,
  type GitSyncSuggestion,
} from "@/lib/mcp/git-sync-suggestions-store";
import { getPmSlugForStudioProject } from "@/lib/project-bridge";
import { confirmShippedRequirements } from "@/lib/mcp/suggest-shipped-from-release";
import { getProjectById } from "@/lib/studio/data";
import { requirementIsDone, type Requirement } from "@/lib/types";

export type CommitHint = {
  sha: string;
  shortSha?: string;
  message: string;
  url: string;
  committedAt?: string | null;
};

function scoreCommit(
  req: Requirement,
  message: string
): { score: number; reasons: string[] } {
  const subject = commitSubject(message);
  let score = 0;
  const reasons: string[] = [];

  if (titlesSimilar(req.title, subject) || titlesSimilar(req.title, message)) {
    score += 3;
    reasons.push(`commit: ${subject.slice(0, 56)}`);
  } else {
    const titleNormParts = req.title
      .replace(/【P[0-3]】/gi, "")
      .split(/[·\-_/：:]/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 4);
    for (const part of titleNormParts) {
      if (titlesSimilar(part, subject)) {
        score += 2;
        reasons.push(`片段: ${part.slice(0, 32)}`);
        break;
      }
    }
  }

  return { score, reasons };
}

async function loadOpenRequirementsForPm(
  pmKey: string
): Promise<Requirement[]> {
  const byId = new Map<string, Requirement>();
  const [pool, board] = await Promise.all([
    getPoolBundle(pmKey).catch(() => null),
    getProjectBundle(pmKey).catch(() => null),
  ]);
  for (const r of pool?.poolRequirements ?? []) byId.set(r.id, r);
  for (const r of board?.requirements ?? []) byId.set(r.id, r);
  return [...byId.values()];
}

async function loadOpenRequirements(input: {
  pmProjectId?: string | null;
  studioProjectId?: string | null;
}): Promise<{ all: Requirement[]; pmProjectId: string | null }> {
  if (input.studioProjectId) {
    const studio = await getProjectById(input.studioProjectId);
    if (!studio) throw new Error("Studio 项目不存在");
    const slug = getPmSlugForStudioProject(studio);
    const pmProjects = await getProjects();
    const pmByName = pmProjects.find((p) => p.name === studio.title);
    const pmBySlug = pmProjects.find(
      (p) => p.slug === slug || p.slug === `studio-${input.studioProjectId}`
    );
    const keys = [
      slug,
      `studio-${input.studioProjectId}`,
      pmBySlug?.slug,
      pmByName?.slug,
      pmBySlug?.id,
      pmByName?.id,
      input.pmProjectId,
    ].filter(Boolean) as string[];

    const byId = new Map<string, Requirement>();
    for (const key of keys) {
      for (const r of await loadOpenRequirementsForPm(key)) {
        byId.set(r.id, r);
      }
    }
    return {
      all: [...byId.values()],
      pmProjectId: pmBySlug?.id ?? pmByName?.id ?? input.pmProjectId ?? null,
    };
  }

  if (!input.pmProjectId) {
    return { all: [], pmProjectId: null };
  }
  const all = await loadOpenRequirementsForPm(input.pmProjectId);
  return { all, pmProjectId: input.pmProjectId };
}

/**
 * Match new commits to open requirements and persist pending suggestions.
 * Does NOT change requirement status.
 */
export async function suggestAndPersistFromCommits(input: {
  pmProjectId?: string | null;
  studioProjectId?: string | null;
  commits: CommitHint[];
}): Promise<{
  created: number;
  skipped: number;
  scannedRequirements: number;
  openLeaves: number;
  suggestions: GitSyncSuggestion[];
}> {
  if (!input.commits.length) {
    return {
      created: 0,
      skipped: 0,
      scannedRequirements: 0,
      openLeaves: 0,
      suggestions: [],
    };
  }

  const { all, pmProjectId } = await loadOpenRequirements(input);
  const leaves = all.filter((r) => !all.some((x) => x.parent_id === r.id));
  const openLeaves = leaves.filter((r) => !requirementIsDone(r));

  const draft: Parameters<typeof upsertGitSyncSuggestions>[0] = [];

  for (const commit of input.commits) {
    const message = commit.message.split("\n")[0] ?? commit.message;
    for (const req of openLeaves) {
      const { score, reasons } = scoreCommit(req, message);
      if (score < 2) continue;
      draft.push({
        pm_project_id: pmProjectId,
        studio_project_id: input.studioProjectId ?? null,
        requirement_id: req.id,
        requirement_title: req.title,
        commit_sha: commit.sha,
        short_sha: commit.shortSha ?? commit.sha.slice(0, 7),
        commit_message: message,
        commit_url: commit.url,
        committed_at: commit.committedAt ?? null,
        score,
        reasons,
      });
    }
  }

  const result = await upsertGitSyncSuggestions(draft);
  return {
    created: result.created,
    skipped: result.skipped,
    scannedRequirements: all.length,
    openLeaves: openLeaves.length,
    suggestions: result.suggestions,
  };
}

export async function listPendingGitSyncSuggestions(input?: {
  pmProjectId?: string;
  studioProjectId?: string;
  limit?: number;
}) {
  const suggestions = await listGitSyncSuggestions({
    status: "pending",
    pmProjectId: input?.pmProjectId,
    studioProjectId: input?.studioProjectId,
    limit: input?.limit,
  });
  return {
    suggestions,
    hint:
      "以上仅为建议，不会自动改状态。确认完成：confirm_git_sync_suggestions(action=accept)；忽略：action=dismiss。",
  };
}

/**
 * Accept → mark requirements complete (reuse A) + resolve suggestions.
 * Dismiss → only resolve suggestions.
 */
export async function confirmGitSyncSuggestions(input: {
  suggestionIds: string[];
  action: "accept" | "dismiss";
  completedAt?: string | null;
}): Promise<{
  action: "accept" | "dismiss";
  resolved: number;
  missing: string[];
  marked?: number;
  failed?: { requirementId: string; error: string }[];
  completedAt?: string;
}> {
  const pending = await listGitSyncSuggestions({ status: "pending", limit: 500 });
  const selected = pending.filter((s) => input.suggestionIds.includes(s.id));
  const foundIds = new Set(selected.map((s) => s.id));
  const missingIds = input.suggestionIds.filter((id) => !foundIds.has(id));

  if (input.action === "dismiss") {
    const { updated, missing } = await resolveGitSyncSuggestions({
      suggestionIds: selected.map((s) => s.id),
      status: "dismissed",
    });
    return {
      action: "dismiss",
      resolved: updated,
      missing: [...missingIds, ...missing],
    };
  }

  const requirementIds = [...new Set(selected.map((s) => s.requirement_id))];
  const ship = await confirmShippedRequirements({
    requirementIds,
    completedAt: input.completedAt,
  });
  const { updated, missing } = await resolveGitSyncSuggestions({
    suggestionIds: selected.map((s) => s.id),
    status: "accepted",
  });

  return {
    action: "accept",
    resolved: updated,
    missing: [...missingIds, ...missing],
    marked: ship.marked,
    failed: ship.failed,
    completedAt: ship.completedAt,
  };
}
