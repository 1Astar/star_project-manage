import { promises as fs } from "node:fs";
import path from "node:path";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type GitSyncSuggestionStatus = "pending" | "accepted" | "dismissed";

export type GitSyncSuggestion = {
  id: string;
  pm_project_id: string | null;
  studio_project_id: string | null;
  requirement_id: string;
  requirement_title: string;
  commit_sha: string;
  short_sha: string;
  commit_message: string;
  commit_url: string;
  committed_at: string | null;
  score: number;
  reasons: string[];
  status: GitSyncSuggestionStatus;
  suggested_at: string;
  resolved_at: string | null;
};

const LOCAL_FILE = path.join(process.cwd(), ".data", "git-sync-suggestions.json");

function uid(): string {
  return `gss-${crypto.randomUUID().slice(0, 12)}`;
}

function normalizeRow(row: Record<string, unknown>): GitSyncSuggestion {
  const reasonsRaw = row.reasons;
  const reasons = Array.isArray(reasonsRaw)
    ? reasonsRaw.map(String)
    : typeof reasonsRaw === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(reasonsRaw);
            return Array.isArray(parsed) ? parsed.map(String) : [];
          } catch {
            return [];
          }
        })()
      : [];
  const status = String(row.status ?? "pending") as GitSyncSuggestionStatus;
  return {
    id: String(row.id),
    pm_project_id: row.pm_project_id != null ? String(row.pm_project_id) : null,
    studio_project_id:
      row.studio_project_id != null ? String(row.studio_project_id) : null,
    requirement_id: String(row.requirement_id),
    requirement_title: String(row.requirement_title ?? ""),
    commit_sha: String(row.commit_sha),
    short_sha: String(row.short_sha ?? String(row.commit_sha).slice(0, 7)),
    commit_message: String(row.commit_message ?? ""),
    commit_url: String(row.commit_url ?? ""),
    committed_at: row.committed_at != null ? String(row.committed_at) : null,
    score: Number(row.score ?? 0),
    reasons,
    status:
      status === "accepted" || status === "dismissed" || status === "pending"
        ? status
        : "pending",
    suggested_at: String(row.suggested_at ?? new Date().toISOString()),
    resolved_at: row.resolved_at != null ? String(row.resolved_at) : null,
  };
}

async function readLocal(): Promise<GitSyncSuggestion[]> {
  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => normalizeRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

async function writeLocal(rows: GitSyncSuggestion[]): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(rows, null, 2), "utf8");
}

function tableMissing(message: string): boolean {
  return /git_sync_suggestions|schema cache|does not exist|Could not find/i.test(
    message
  );
}

export type GitSyncSuggestionDraft = Omit<
  GitSyncSuggestion,
  "id" | "suggested_at" | "resolved_at" | "status"
> &
  Partial<Pick<GitSyncSuggestion, "id" | "suggested_at" | "status">>;

export async function upsertGitSyncSuggestions(
  rows: GitSyncSuggestionDraft[]
): Promise<{ created: number; skipped: number; suggestions: GitSyncSuggestion[] }> {
  if (!rows.length) return { created: 0, skipped: 0, suggestions: [] };

  const now = new Date().toISOString();
  const prepared: GitSyncSuggestion[] = rows.map((r) => ({
    id: r.id ?? uid(),
    pm_project_id: r.pm_project_id ?? null,
    studio_project_id: r.studio_project_id ?? null,
    requirement_id: r.requirement_id,
    requirement_title: r.requirement_title,
    commit_sha: r.commit_sha,
    short_sha: r.short_sha,
    commit_message: r.commit_message,
    commit_url: r.commit_url,
    committed_at: r.committed_at ?? null,
    score: r.score,
    reasons: r.reasons ?? [],
    status: r.status ?? "pending",
    suggested_at: r.suggested_at ?? now,
    resolved_at: null,
  }));

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (!sb) throw new Error("Supabase 未配置");

    const { data: existing, error: existErr } = await sb
      .from("git_sync_suggestions")
      .select("requirement_id, commit_sha")
      .in(
        "requirement_id",
        [...new Set(prepared.map((p) => p.requirement_id))]
      );

    if (existErr) {
      if (tableMissing(existErr.message)) {
        // fall through to local
      } else {
        throw new Error(existErr.message);
      }
    } else {
      const keys = new Set(
        ((existing ?? []) as { requirement_id: string; commit_sha: string }[]).map(
          (e) => `${e.requirement_id}::${e.commit_sha}`
        )
      );
      const fresh = prepared.filter(
        (p) => !keys.has(`${p.requirement_id}::${p.commit_sha}`)
      );
      if (!fresh.length) {
        return { created: 0, skipped: prepared.length, suggestions: [] };
      }
      const payload = fresh.map((p) => ({
        ...p,
        reasons: p.reasons,
      }));
      const { error } = await sb.from("git_sync_suggestions").insert(payload);
      if (error) {
        if (tableMissing(error.message)) {
          // local fallback below
        } else {
          throw new Error(error.message);
        }
      } else {
        return {
          created: fresh.length,
          skipped: prepared.length - fresh.length,
          suggestions: fresh,
        };
      }
    }
  }

  const local = await readLocal();
  const keys = new Set(local.map((e) => `${e.requirement_id}::${e.commit_sha}`));
  const fresh = prepared.filter(
    (p) => !keys.has(`${p.requirement_id}::${p.commit_sha}`)
  );
  if (!fresh.length) {
    return { created: 0, skipped: prepared.length, suggestions: [] };
  }
  await writeLocal([...local, ...fresh]);
  return {
    created: fresh.length,
    skipped: prepared.length - fresh.length,
    suggestions: fresh,
  };
}

export async function listGitSyncSuggestions(input?: {
  status?: GitSyncSuggestionStatus;
  pmProjectId?: string;
  studioProjectId?: string;
  limit?: number;
}): Promise<GitSyncSuggestion[]> {
  const status = input?.status ?? "pending";
  const limit = input?.limit ?? 50;

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      let q = sb
        .from("git_sync_suggestions")
        .select("*")
        .eq("status", status)
        .order("suggested_at", { ascending: false })
        .limit(limit);
      if (input?.pmProjectId) q = q.eq("pm_project_id", input.pmProjectId);
      if (input?.studioProjectId) {
        q = q.eq("studio_project_id", input.studioProjectId);
      }
      const { data, error } = await q;
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return ((data ?? []) as Record<string, unknown>[]).map(normalizeRow);
      }
    }
  }

  let rows = await readLocal();
  rows = rows.filter((r) => r.status === status);
  if (input?.pmProjectId) {
    rows = rows.filter((r) => r.pm_project_id === input.pmProjectId);
  }
  if (input?.studioProjectId) {
    rows = rows.filter((r) => r.studio_project_id === input.studioProjectId);
  }
  return rows
    .sort((a, b) => b.suggested_at.localeCompare(a.suggested_at))
    .slice(0, limit);
}

export async function resolveGitSyncSuggestions(input: {
  suggestionIds: string[];
  status: "accepted" | "dismissed";
}): Promise<{ updated: number; missing: string[] }> {
  const resolvedAt = new Date().toISOString();
  const ids = [...new Set(input.suggestionIds)];
  const missing: string[] = [];

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("git_sync_suggestions")
        .update({ status: input.status, resolved_at: resolvedAt })
        .in("id", ids)
        .eq("status", "pending")
        .select("id");
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        const updatedIds = new Set(
          ((data ?? []) as { id: string }[]).map((r) => r.id)
        );
        for (const id of ids) {
          if (!updatedIds.has(id)) missing.push(id);
        }
        return { updated: updatedIds.size, missing };
      }
    }
  }

  const local = await readLocal();
  let updated = 0;
  const next = local.map((row) => {
    if (!ids.includes(row.id)) return row;
    if (row.status !== "pending") {
      missing.push(row.id);
      return row;
    }
    updated += 1;
    return { ...row, status: input.status, resolved_at: resolvedAt };
  });
  for (const id of ids) {
    if (!local.some((r) => r.id === id) && !missing.includes(id)) {
      missing.push(id);
    }
  }
  await writeLocal(next);
  return { updated, missing };
}
