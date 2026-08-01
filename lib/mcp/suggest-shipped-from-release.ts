import { AGENT_ACTOR_NAME } from "@/lib/cursor-actor";
import {
  getPoolBundle,
  getProjectBundle,
  getProjects,
  getRequirementDetail,
  updateRequirement,
} from "@/lib/db/local-store";
import { changelogBulletLead, titlesSimilar } from "@/lib/mcp/title-match";
import { getPmSlugForStudioProject } from "@/lib/project-bridge";
import { applyLifecycleStatus } from "@/lib/requirement-status";
import {
  parseChangelogSections,
  readRepoChangelog,
} from "@/lib/studio/import-changelog";
import { getProjectById, getProjectEvolution } from "@/lib/studio/data";
import { requirementIsDone, type Requirement } from "@/lib/types";

export type ShippedCandidate = {
  requirementId: string;
  title: string;
  score: number;
  reasons: string[];
  matchedBullets: string[];
  currentStatusTags: string[];
};

async function loadOpenRequirements(studioProjectId: string): Promise<{
  all: Requirement[];
  slugTried: string[];
}> {
  const studio = await getProjectById(studioProjectId);
  if (!studio) throw new Error("Studio 项目不存在");

  const slug = getPmSlugForStudioProject(studio);
  const pmProjects = await getProjects();
  const pmByName = pmProjects.find((p) => p.name === studio.title);
  const pmBySlug = pmProjects.find(
    (p) => p.slug === slug || p.slug === `studio-${studioProjectId}`
  );

  const slugTried = [
    slug,
    `studio-${studioProjectId}`,
    pmBySlug?.slug,
    pmByName?.slug,
    pmBySlug?.id,
    pmByName?.id,
  ].filter(Boolean) as string[];

  const byId = new Map<string, Requirement>();
  for (const key of slugTried) {
    const [pool, board] = await Promise.all([
      getPoolBundle(key).catch(() => null),
      getProjectBundle(key).catch(() => null),
    ]);
    for (const r of pool?.poolRequirements ?? []) byId.set(r.id, r);
    for (const r of board?.requirements ?? []) byId.set(r.id, r);
  }

  return { all: [...byId.values()], slugTried };
}

function scoreRequirement(
  req: Requirement,
  bullets: string[],
  evolutionTitles: string[]
): { score: number; reasons: string[]; matchedBullets: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const matchedBullets: string[] = [];

  for (const bullet of bullets) {
    const lead = changelogBulletLead(bullet);
    if (titlesSimilar(req.title, lead) || titlesSimilar(req.title, bullet)) {
      score += 3;
      reasons.push(`CHANGELOG: ${lead.slice(0, 48)}`);
      matchedBullets.push(bullet);
      continue;
    }
    // weaker: module-ish substring in title
    if (lead.length >= 4 && titlesSimilar(req.title, lead.slice(0, Math.min(lead.length, 24)))) {
      score += 1;
      reasons.push(`弱匹配: ${lead.slice(0, 32)}`);
      matchedBullets.push(bullet);
    }
  }

  for (const et of evolutionTitles) {
    if (titlesSimilar(req.title, et)) {
      score += 2;
      reasons.push(`演进: ${et.slice(0, 48)}`);
    }
  }

  return { score, reasons: [...new Set(reasons)], matchedBullets };
}

/**
 * Suggest open requirements that look shipped by this release tag.
 * Does NOT mutate — caller must confirm_shipped_requirements.
 */
export async function suggestShippedFromRelease(input: {
  projectId: string;
  tag: string;
  changelogMd?: string;
}): Promise<{
  tag: string;
  completedAtHint: string;
  bullets: string[];
  candidates: ShippedCandidate[];
  scannedRequirements: number;
  openLeaves: number;
  hint: string;
}> {
  const tag = input.tag.trim();
  if (!tag) throw new Error("tag 必填");

  const md = input.changelogMd ?? readRepoChangelog();
  const section = parseChangelogSections(md).find(
    (s) => s.tag === tag || s.tag === tag.replace(/^v/i, "v")
  );
  const bullets = section?.bullets ?? [];
  const completedAtHint = section?.date
    ? `${section.date}T12:00:00.000Z`
    : new Date().toISOString();

  const evolutions = await getProjectEvolution(input.projectId);
  const evolutionTitles = evolutions
    .filter((e) => e.releaseTag?.trim() === tag)
    .map((e) => e.title);

  const { all } = await loadOpenRequirements(input.projectId);
  const leaves = all.filter((r) => !all.some((x) => x.parent_id === r.id));
  const openLeaves = leaves.filter((r) => !requirementIsDone(r));

  const candidates: ShippedCandidate[] = [];
  for (const r of openLeaves) {
    const { score, reasons, matchedBullets } = scoreRequirement(
      r,
      bullets,
      evolutionTitles
    );
    if (score < 2) continue;
    candidates.push({
      requirementId: r.id,
      title: r.title,
      score,
      reasons,
      matchedBullets,
      currentStatusTags: r.status_tags ?? [],
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "zh"));

  return {
    tag,
    completedAtHint,
    bullets,
    candidates,
    scannedRequirements: all.length,
    openLeaves: openLeaves.length,
    hint:
      "以上仅为建议，不会自动改状态。确认后调用 confirm_shipped_requirements，传入 requirementIds（可带 completedAt）。",
  };
}

/** Apply confirmed shipped marks (lifecycle 完成 + completed_at). */
export async function confirmShippedRequirements(input: {
  requirementIds: string[];
  completedAt?: string | null;
}): Promise<{
  marked: number;
  failed: { requirementId: string; error: string }[];
  completedAt: string;
}> {
  const completedAt = input.completedAt?.trim() || new Date().toISOString();
  const failed: { requirementId: string; error: string }[] = [];
  let marked = 0;

  for (const id of input.requirementIds) {
    try {
      const detail = await getRequirementDetail(id);
      const req = detail?.requirement;
      if (!req) throw new Error("需求不存在");
      await updateRequirement(
        id,
        {
          status_tags: applyLifecycleStatus(req.status_tags, "完成"),
          completed_at: completedAt,
        },
        { name: AGENT_ACTOR_NAME, role: "ai" }
      );
      marked += 1;
    } catch (e) {
      failed.push({
        requirementId: id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { marked, failed, completedAt };
}
