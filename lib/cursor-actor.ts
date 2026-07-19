/**
 * 代理写入 PM 时的操作者代号（不挂平台品牌名）。
 * 白昼 = 本助手（Cursor 侧）
 * 星辰 = ChatGPT 侧
 */

export const AGENT_ACTOR_NAME = "白昼";
export const GPT_ACTOR_NAME = "星辰";

/** @deprecated */
export const CURSOR_ACTOR_NAME = AGENT_ACTOR_NAME;

/** activity_logs.old_value 前缀：灰色窗口备注 */
export const AGENT_NOTE_PREFIX = "__agent_note__:";
/** 兼容旧写入 */
export const CURSOR_NOTE_PREFIX = "__cursor_note__:";

const LEGACY_AGENT_NAMES = ["白昼", "尘", "Auto", "Cursor", "系统"] as const;
const LEGACY_GPT_NAMES = ["星辰", "墨", "ChatGPT", "GPT"] as const;

export function encodeAgentActivityNote(note: string | null | undefined): string | null {
  const t = note?.trim();
  if (!t) return null;
  return `${AGENT_NOTE_PREFIX}${t}`;
}

/** @deprecated */
export const encodeCursorActivityNote = encodeAgentActivityNote;

export function decodeAgentActivityNote(oldValue: string | null | undefined): string | null {
  if (!oldValue) return null;
  if (oldValue.startsWith(AGENT_NOTE_PREFIX)) {
    return oldValue.slice(AGENT_NOTE_PREFIX.length).trim() || null;
  }
  if (oldValue.startsWith(CURSOR_NOTE_PREFIX)) {
    return oldValue.slice(CURSOR_NOTE_PREFIX.length).trim() || null;
  }
  return null;
}

/** @deprecated */
export const decodeCursorActivityNote = decodeAgentActivityNote;

const SOURCE_PREFIX_RE = /^(白昼|星辰|尘|墨|Auto|Cursor|ChatGPT|GPT)\s*·\s*/i;

function stripSourcePrefix(raw: string): string {
  return raw.replace(SOURCE_PREFIX_RE, "").trim();
}

function isLegacyAgentHead(head: string) {
  return LEGACY_AGENT_NAMES.some((n) => n.toLowerCase() === head.toLowerCase());
}

function isLegacyGptHead(head: string) {
  return LEGACY_GPT_NAMES.some((n) => n.toLowerCase() === head.toLowerCase());
}

/** 本助手灵感来源：白昼 · 窗口/话题 */
export function formatAgentInspiration(parts: {
  chatTopic?: string | null;
  sourceChat?: string | null;
  triggerSource?: string | null;
  windowNote?: string | null;
}): string {
  const window =
    parts.windowNote?.trim() ||
    parts.chatTopic?.trim() ||
    parts.sourceChat?.trim() ||
    parts.triggerSource?.trim() ||
    "对话入库";
  return `${AGENT_ACTOR_NAME} · ${stripSourcePrefix(window) || "对话入库"}`;
}

/** ChatGPT 灵感来源：星辰 · 窗口/话题 */
export function formatGptInspiration(parts: {
  chatTopic?: string | null;
  sourceChat?: string | null;
  triggerSource?: string | null;
  windowNote?: string | null;
}): string {
  const window =
    parts.windowNote?.trim() ||
    parts.chatTopic?.trim() ||
    parts.sourceChat?.trim() ||
    parts.triggerSource?.trim() ||
    "对话入库";
  return `${GPT_ACTOR_NAME} · ${stripSourcePrefix(window) || "对话入库"}`;
}

/** @deprecated */
export const formatCursorInspiration = formatAgentInspiration;

export function formatAgentAssetTakeaway(windowNote: string, detail?: string): string {
  const base = formatAgentInspiration({ windowNote });
  const d = detail?.trim();
  return d ? `${base} · ${d}` : base;
}

/** @deprecated */
export const formatCursorAssetTakeaway = formatAgentAssetTakeaway;

/** 展示用操作者：旧名映射到白昼 / 星辰 */
export function displayActorName(name: string | null | undefined): string {
  if (!name) return AGENT_ACTOR_NAME;
  if (isLegacyAgentHead(name)) return AGENT_ACTOR_NAME;
  if (isLegacyGptHead(name)) return GPT_ACTOR_NAME;
  return name;
}

export type AgentSourceKind = "day" | "star" | "other";

/** 解析灵感来源 / takeaway */
export function parseAgentSourceLabel(raw: string | null | undefined): {
  kind: AgentSourceKind;
  label: string | null;
  note: string;
} {
  const t = raw?.trim() || "";
  const m = t.match(/^(白昼|星辰|尘|墨|Auto|Cursor|ChatGPT|GPT)\s*·\s*(.+)$/i);
  if (m) {
    const head = m[1];
    const note = m[2].trim();
    if (isLegacyAgentHead(head)) {
      return { kind: "day", label: AGENT_ACTOR_NAME, note };
    }
    if (isLegacyGptHead(head)) {
      return { kind: "star", label: GPT_ACTOR_NAME, note };
    }
  }
  if (/chatgpt|^gpt\b/i.test(t) && !/cursor|白昼|尘/i.test(t)) {
    return { kind: "star", label: GPT_ACTOR_NAME, note: stripSourcePrefix(t) || t };
  }
  return { kind: "other", label: null, note: t };
}
