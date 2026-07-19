import type { EmotionLevel, IdeaStatus, IdeaType } from "@/lib/studio/types";
import { IDEA_TYPE_CAPTURE_LABELS } from "@/lib/studio/types";

export type IdeaCapturePayload = {
  title: string;
  rawThought?: string;
  rawInput?: string;
  summary?: string;
  oneLineIdea?: string;
  why?: string;
  whyItMatters?: string;
  /** AI 补充 */
  aiSupplement?: string;
  /** 聊天主题 */
  chatTopic?: string;
  type?: string;
  source?: string;
  /** 来源聊天 */
  sourceChat?: string;
  /** 来源方式 */
  sourceMethod?: string;
  status?: string;
  emotionLevel?: string;
  relatedProjectId?: string | null;
  relatedIdeaId?: string | null;
  relatedModule?: string;
  suggestedNextStep?: string;
  decisionNotes?: string;
  evolutionNotes?: string;
  relatedAssetsNote?: string;
  priority?: string;
  /** 灵感发生时间 ISO */
  occurredAt?: string | null;
  /** 查重命中时仍强制新建 */
  force?: boolean;
  /** 关闭自动挂父 Idea */
  skipParentAuto?: boolean;
};

const STATUS_MAP: Record<string, IdeaStatus> = {
  inbox: "inbox",
  reviewing: "reviewing",
  converted: "converted",
  done: "done",
  parked: "parked",
  archived: "archived",
  灵感收件箱: "inbox",
  收件箱: "inbox",
  灵感池: "inbox",
  审阅中: "reviewing",
  验证中: "reviewing",
  开发中: "reviewing",
  已转项目: "converted",
  已完成: "done",
  完成: "done",
  停车场: "parked",
  已归档: "archived",
};

const EMOTION_MAP: Record<string, EmotionLevel> = {
  normal: "normal",
  like: "like",
  excited: "excited",
  普通: "normal",
  喜欢: "like",
  很想做: "excited",
};

export function normalizeCapturePayload(body: IdeaCapturePayload) {
  const title = body.title?.trim();
  if (!title) throw new Error("title 必填");

  const rawThought = (body.rawThought ?? body.rawInput ?? "").trim();
  const summary = (body.summary ?? body.oneLineIdea ?? "").trim();
  const whyItMatters = (body.whyItMatters ?? body.why ?? "").trim();
  const typeLabel = (body.type ?? "产品想法").trim();
  const type: IdeaType =
    IDEA_TYPE_CAPTURE_LABELS[typeLabel] ??
    (["product", "feature", "ui", "content", "tech", "business"].includes(typeLabel)
      ? (typeLabel as IdeaType)
      : "product");

  const sourceMethod = (body.sourceMethod ?? body.source ?? "ChatGPT").trim();
  const statusKey = (body.status ?? "inbox").trim();
  const status = STATUS_MAP[statusKey] ?? STATUS_MAP[statusKey.toLowerCase()] ?? "inbox";
  const emotionKey = (body.emotionLevel ?? "普通").trim();
  const emotionLevel =
    EMOTION_MAP[emotionKey] ?? EMOTION_MAP[emotionKey.toLowerCase()] ?? "normal";

  return {
    title,
    rawThought,
    summary,
    whyItMatters,
    aiSupplement: (body.aiSupplement ?? "").trim(),
    chatTopic: (body.chatTopic ?? "").trim(),
    type,
    typeLabel,
    source: sourceMethod,
    sourceChat: (body.sourceChat ?? "").trim(),
    sourceMethod,
    status,
    emotionLevel,
    relatedProjectId: body.relatedProjectId ?? null,
    relatedIdeaId: body.relatedIdeaId ?? null,
    relatedModule: (body.relatedModule ?? "").trim(),
    suggestedNextStep: body.suggestedNextStep?.trim() ?? "",
    decisionNotes: (body.decisionNotes ?? "").trim(),
    evolutionNotes: (body.evolutionNotes ?? "").trim(),
    relatedAssetsNote: (body.relatedAssetsNote ?? "").trim(),
    priority: body.priority,
    occurredAt: body.occurredAt?.trim() || null,
  };
}

export function buildIdeaIssueBody(fields: ReturnType<typeof normalizeCapturePayload>) {
  const lines = [
    "---",
    `title: ${fields.title}`,
    `rawThought: |`,
    ...fields.rawThought.split("\n").map((line) => `  ${line}`),
    `summary: ${fields.summary}`,
    `whyItMatters: ${fields.whyItMatters}`,
    `type: ${fields.typeLabel}`,
    `source: ${fields.source}`,
    `status: ${fields.status}`,
    `emotionLevel: ${fields.emotionLevel}`,
  ];
  if (fields.chatTopic) lines.push(`chatTopic: ${fields.chatTopic}`);
  if (fields.aiSupplement) lines.push(`aiSupplement: ${fields.aiSupplement}`);
  if (fields.sourceChat) lines.push(`sourceChat: ${fields.sourceChat}`);
  if (fields.relatedModule) lines.push(`relatedModule: ${fields.relatedModule}`);
  if (fields.relatedIdeaId) lines.push(`relatedIdeaId: ${fields.relatedIdeaId}`);
  if (fields.decisionNotes) lines.push(`decisionNotes: ${fields.decisionNotes}`);
  if (fields.evolutionNotes) lines.push(`evolutionNotes: ${fields.evolutionNotes}`);
  if (fields.relatedAssetsNote) lines.push(`relatedAssetsNote: ${fields.relatedAssetsNote}`);
  if (fields.suggestedNextStep) {
    lines.push(`suggestedNextStep: ${fields.suggestedNextStep}`);
  }
  if (fields.relatedProjectId) {
    lines.push(`relatedProjectId: ${fields.relatedProjectId}`);
  }
  lines.push("---", "", fields.rawThought || fields.summary || "");
  return lines.join("\n");
}

export function parseIdeaIssueBody(body: string): Partial<IdeaCapturePayload> {
  const frontmatterMatch = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    return { rawThought: body.trim() };
  }

  const block = frontmatterMatch[1];
  const result: Record<string, string> = {};
  let key = "";
  let valueLines: string[] = [];
  let inMultiline = false;

  for (const line of block.split("\n")) {
    if (inMultiline) {
      if (line.startsWith("  ")) {
        valueLines.push(line.slice(2));
        continue;
      }
      result[key] = valueLines.join("\n");
      inMultiline = false;
      valueLines = [];
    }
    const match = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (!match) continue;
    key = match[1];
    const rest = match[2];
    if (rest === "|") {
      inMultiline = true;
      valueLines = [];
    } else {
      result[key] = rest;
    }
  }
  if (inMultiline && key) {
    result[key] = valueLines.join("\n");
  }

  return {
    title: result.title,
    rawThought: result.rawThought,
    summary: result.summary,
    whyItMatters: result.whyItMatters,
    type: result.type,
    source: result.source,
    status: result.status,
    emotionLevel: result.emotionLevel,
    suggestedNextStep: result.suggestedNextStep,
    relatedProjectId: result.relatedProjectId ?? null,
  };
}

export function buildIdeaIssueLabels(fields: ReturnType<typeof normalizeCapturePayload>) {
  return [
    "type:idea",
    `source:${fields.source.toLowerCase()}`,
    `status:${fields.status}`,
    `idea-type:${fields.type}`,
  ];
}
