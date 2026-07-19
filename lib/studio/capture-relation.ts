import type { Idea } from "@/lib/studio/types";

export type CaptureRelationCandidate = {
  id: string;
  title: string;
  status: Idea["status"];
  type: Idea["type"];
  relatedProjectId: string | null;
  score: number;
  reason: string;
};

export class CaptureDuplicateError extends Error {
  readonly code = "DUPLICATE" as const;
  readonly candidates: CaptureRelationCandidate[];

  constructor(message: string, candidates: CaptureRelationCandidate[]) {
    super(message);
    this.name = "CaptureDuplicateError";
    this.candidates = candidates;
  }
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s\-_ /|·：:，,。.?？!！()（）[\]【】「」""'']/g, "");
}

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[\s\-_ /|·：:，,。.?？!！()（）[\]【】]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 0–1 标题相似度 */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return 0.84 + ratio * 0.12;
  }
  return jaccard(tokens(a), tokens(b));
}

function isActiveIdea(idea: Idea) {
  return idea.status !== "parked" && idea.status !== "archived";
}

/** 查重：高相似活跃灵感 */
export function findDuplicateCandidates(
  ideas: Idea[],
  title: string,
  options?: { projectId?: string | null; threshold?: number; limit?: number }
): CaptureRelationCandidate[] {
  const threshold = options?.threshold ?? 0.85;
  const limit = options?.limit ?? 5;
  const scored: CaptureRelationCandidate[] = [];

  for (const idea of ideas) {
    if (!isActiveIdea(idea)) continue;
    if (options?.projectId && idea.relatedProjectId && idea.relatedProjectId !== options.projectId) {
      continue;
    }
    const score = titleSimilarity(title, idea.title);
    if (score < threshold) continue;
    scored.push({
      id: idea.id,
      title: idea.title,
      status: idea.status,
      type: idea.type,
      relatedProjectId: idea.relatedProjectId,
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

/**
 * 推断父 Idea：优先「无父级的总纲」
 * — product / reviewing / 同项目；标题有交集且父标题更像 epic
 */
export function suggestParentIdea(
  ideas: Idea[],
  input: {
    title: string;
    projectId?: string | null;
    type?: string;
  }
): { parent: CaptureRelationCandidate | null; alternatives: CaptureRelationCandidate[] } {
  const titleTok = tokens(input.title);
  const scored: CaptureRelationCandidate[] = [];

  for (const idea of ideas) {
    if (!isActiveIdea(idea)) continue;
    if (idea.relatedIdeaId) continue; // 只要顶层总纲
    if (input.projectId && idea.relatedProjectId && idea.relatedProjectId !== input.projectId) {
      continue;
    }

    let score = titleSimilarity(input.title, idea.title) * 0.55;
    const overlap = jaccard(titleTok, tokens(idea.title));
    score += overlap * 0.35;

    // 父级通常是 product / 验证中，或明确比新标题更短的「系统/OS/工作台」类
    if (idea.type === "product") score += 0.08;
    if (idea.status === "reviewing" || idea.status === "converted") score += 0.06;
    if (/系统|OS|工作台|引擎|模型|通道|捕获|记忆/.test(idea.title)) score += 0.08;
    // 新标题明显更细，父标题被包含时加分
    const childN = normalizeTitle(input.title);
    const parentN = normalizeTitle(idea.title);
    if (childN.includes(parentN) && parentN.length >= 4 && childN.length > parentN.length + 2) {
      score += 0.12;
    }
    // 避免把几乎相同标题当父
    if (titleSimilarity(input.title, idea.title) >= 0.9) score -= 0.4;

    if (score < 0.28) continue;

    scored.push({
      id: idea.id,
      title: idea.title,
      status: idea.status,
      type: idea.type,
      relatedProjectId: idea.relatedProjectId,
      score: Number(score.toFixed(3)),
      reason: "标题相关的顶层总纲，疑似父需求",
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0] ?? null;
  const second = scored[1];
  if (!top) return { parent: null, alternatives: [] };

  const confident =
    top.score >= 0.38 && (!second || top.score - second.score >= 0.06 || top.score >= 0.5);

  return {
    parent: confident ? top : null,
    alternatives: scored.slice(0, 5),
  };
}
