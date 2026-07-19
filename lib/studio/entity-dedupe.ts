import { titleSimilarity } from "@/lib/studio/capture-relation";
import type { Asset, Project } from "@/lib/studio/types";

export type EntityDuplicateCandidate = {
  id: string;
  title: string;
  score: number;
  reason: string;
};

export class StudioDuplicateError extends Error {
  readonly code = "DUPLICATE" as const;

  constructor(
    message: string,
    public readonly kind: "project" | "asset",
    public readonly candidates: EntityDuplicateCandidate[],
    public readonly hint: string
  ) {
    super(message);
    this.name = "StudioDuplicateError";
  }
}

export function isStudioDuplicateError(error: unknown): error is StudioDuplicateError {
  return (
    error instanceof StudioDuplicateError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "DUPLICATE" &&
      "candidates" in error)
  );
}

/** 规范化 URL：去尾斜杠、小写 host、去默认端口 */
export function normalizeAssetUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "") || "";
    const host = u.hostname.toLowerCase();
    const port =
      (u.port === "80" && u.protocol === "http:") ||
      (u.port === "443" && u.protocol === "https:")
        ? ""
        : u.port;
    const origin = `${u.protocol}//${host}${port ? `:${port}` : ""}`;
    return `${origin}${path}${u.search}`.toLowerCase();
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
}

function isActiveProject(project: Project) {
  return project.status !== "archived" && project.status !== "parking";
}

/** 非 archived/parking 项目；标题相似度 ≥ threshold */
export function findDuplicateProjects(
  projects: Project[],
  title: string,
  options?: { threshold?: number; limit?: number }
): EntityDuplicateCandidate[] {
  const threshold = options?.threshold ?? 0.85;
  const limit = options?.limit ?? 5;
  const scored: EntityDuplicateCandidate[] = [];

  for (const project of projects) {
    if (!isActiveProject(project)) continue;
    const score = titleSimilarity(title, project.title);
    if (score < threshold) continue;
    scored.push({
      id: project.id,
      title: project.title,
      score: Number(score.toFixed(3)),
      reason:
        score >= 0.99
          ? "标题几乎相同"
          : score >= 0.9
            ? "标题高度包含/重合"
            : "标题词集合高度相似",
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/** 同项目内：标题相似，或规范化 URL 完全相同 */
export function findDuplicateAssets(
  assets: Asset[],
  input: { title: string; projectId: string; url?: string | null },
  options?: { threshold?: number; limit?: number }
): EntityDuplicateCandidate[] {
  const threshold = options?.threshold ?? 0.85;
  const limit = options?.limit ?? 5;
  const wantUrl = normalizeAssetUrl(input.url ?? "");
  const scored: EntityDuplicateCandidate[] = [];

  for (const asset of assets) {
    if (asset.projectId !== input.projectId) continue;

    if (wantUrl) {
      const existingUrl = normalizeAssetUrl(asset.url ?? "");
      if (existingUrl && existingUrl === wantUrl) {
        scored.push({
          id: asset.id,
          title: asset.title,
          score: 1,
          reason: "URL 相同",
        });
        continue;
      }
    }

    const score = titleSimilarity(input.title, asset.title);
    if (score < threshold) continue;
    scored.push({
      id: asset.id,
      title: asset.title,
      score: Number(score.toFixed(3)),
      reason:
        score >= 0.99
          ? "标题几乎相同"
          : score >= 0.9
            ? "标题高度包含/重合"
            : "标题词集合高度相似",
    });
  }

  // 同 id 可能因 URL+标题各命中一次，去重取高分
  const byId = new Map<string, EntityDuplicateCandidate>();
  for (const c of scored) {
    const prev = byId.get(c.id);
    if (!prev || c.score > prev.score) byId.set(c.id, c);
  }

  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export function assertNoDuplicateProject(
  projects: Project[],
  title: string,
  force?: boolean
): void {
  if (force) return;
  const duplicates = findDuplicateProjects(projects, title);
  if (duplicates.length === 0) return;
  throw new StudioDuplicateError(
    `疑似重复项目（最高相似 ${duplicates[0].score}）：${duplicates[0].title}（${duplicates[0].id}）。请改用 update_project，或传 force:true 强制新建。`,
    "project",
    duplicates,
    "请 update_project 更新已有项目，或 force:true 强制新建"
  );
}

export function assertNoDuplicateAsset(
  assets: Asset[],
  input: { title: string; projectId: string; url?: string | null },
  force?: boolean
): void {
  if (force) return;
  const duplicates = findDuplicateAssets(assets, input);
  if (duplicates.length === 0) return;
  throw new StudioDuplicateError(
    `疑似重复资产（最高相似 ${duplicates[0].score}）：${duplicates[0].title}（${duplicates[0].id}）。请改用已有资料，或传 force:true 强制新建。`,
    "asset",
    duplicates,
    "请更新已有资产，或 force:true 强制新建"
  );
}
