/**
 * 导入冲突 5b：标题 / 正文相似度（无外部依赖）。
 * 规则：字符 bigram/字集 Jaccard + 标题包含；阈值约 0.55 视为「内容相似」。
 */

export const CONTENT_SIMILARITY_THRESHOLD = 0.55;

function normalize(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function bigrams(s: string): Set<string> {
  const n = normalize(s);
  if (!n) return new Set();
  if (n.length < 2) return new Set([n]);
  const set = new Set<string>();
  for (let i = 0; i < n.length - 1; i++) set.add(n.slice(i, i + 2));
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/** 标题互相包含（较短 ≥4 字）时给加成 */
function titleContainScore(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length < 4 || nb.length < 4) return 0;
  if (na.includes(nb) || nb.includes(na)) {
    return Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
  }
  return 0;
}

/**
 * @returns 0～1；≥ CONTENT_SIMILARITY_THRESHOLD 视为相似
 */
export function contentSimilarity(
  titleA: string,
  contentA: string,
  titleB: string,
  contentB: string
): number {
  const titleScore = Math.max(
    jaccard(bigrams(titleA), bigrams(titleB)),
    titleContainScore(titleA, titleB)
  );
  const bodyA = normalize(contentA);
  const bodyB = normalize(contentB);
  if (!bodyA || !bodyB) return titleScore;
  const bodyScore = Math.max(
    jaccard(bigrams(contentA), bigrams(contentB)),
    jaccard(new Set([...bodyA]), new Set([...bodyB]))
  );
  return titleScore * 0.4 + bodyScore * 0.6;
}

export function joinContentParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join("\n");
}
