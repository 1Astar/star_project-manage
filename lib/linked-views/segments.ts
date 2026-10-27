import {
  LINKED_VIEW_FENCE,
  parseLinkedViewConfig,
  serializeLinkedViewFence,
  type LinkedViewConfig,
} from "./config";

export type MdSegment = { type: "md"; id: string; text: string };
export type ViewSegment = { type: "view"; id: string; config: LinkedViewConfig };
export type BodySegment = MdSegment | ViewSegment;

const FENCE_RE = /```star-view[ \t]*\r?\n([\s\S]*?)```/gi;

function segId(prefix: string, i: number): string {
  return `${prefix}${i}`;
}

/** 把正文拆成 Markdown 段 + 关联视图块（顺序即页内位置） */
export function splitBodySegments(markdown: string): BodySegment[] {
  const src = markdown ?? "";
  const segments: BodySegment[] = [];
  let last = 0;
  let i = 0;
  FENCE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(src))) {
    const before = src.slice(last, m.index);
    if (before) {
      segments.push({ type: "md", id: segId("md", i++), text: before });
    }
    const config = parseLinkedViewConfig(m[1] ?? "");
    if (config) {
      segments.push({ type: "view", id: segId("view", i++), config });
    } else {
      segments.push({ type: "md", id: segId("md", i++), text: m[0] });
    }
    last = m.index + m[0].length;
  }
  const rest = src.slice(last);
  if (rest || segments.length === 0) {
    segments.push({ type: "md", id: segId("md", i++), text: rest });
  }
  return segments;
}

/** 把连续 Markdown 再拆成可拖动的段落块（空行分隔） */
export function explodeMdBlocks(segments: BodySegment[]): BodySegment[] {
  const out: BodySegment[] = [];
  let i = 0;
  for (const s of segments) {
    if (s.type === "view") {
      out.push({ ...s, id: s.id || `view-${i++}` });
      continue;
    }
    const chunks = (s.text ?? "").split(/\n{2,}/);
    if (chunks.length === 0) {
      out.push({ type: "md", id: `md-${i++}`, text: "" });
      continue;
    }
    for (const chunk of chunks) {
      out.push({ type: "md", id: `md-${i++}`, text: chunk });
    }
  }
  return out.length ? out : [{ type: "md", id: "md-0", text: "" }];
}

export function joinBodySegments(segments: BodySegment[]): string {
  let out = "";
  for (const s of segments) {
    const chunk =
      s.type === "md" ? s.text : serializeLinkedViewFence(s.config);
    if (!chunk) continue;
    if (!out) {
      out = chunk;
      continue;
    }
    const needNl = !out.endsWith("\n") && !chunk.startsWith("\n");
    out += (needNl ? "\n" : "") + chunk;
  }
  return out;
}

export function defaultLinkedViewConfig(input: {
  source: LinkedViewConfig["source"];
  title: string;
  moduleName?: string;
}): LinkedViewConfig {
  const moduleName = input.moduleName?.trim() ?? "";
  const filters = moduleName
    ? [
        {
          id: "f-mod",
          field: "module",
          op: "contains" as const,
          value: moduleName,
        },
      ]
    : [];
  const title = moduleName
    ? `${moduleName} | 关联${input.title}`
    : `关联${input.title}`;
  return {
    v: 1,
    source: input.source,
    title,
    filters,
    sort: null,
    groupBy: null,
  };
}

/** @internal 仅测试：语言标记 */
export const linkedViewFenceLang = LINKED_VIEW_FENCE;
