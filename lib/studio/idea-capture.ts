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
  type?: string;
  source?: string;
  status?: string;
  emotionLevel?: string;
  relatedProjectId?: string | null;
  suggestedNextStep?: string;
  priority?: string;
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
  审阅中: "reviewing",
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

  const source = (body.source ?? "ChatGPT").trim();
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
    type,
    typeLabel,
    source,
    status,
    emotionLevel,
    relatedProjectId: body.relatedProjectId ?? null,
    suggestedNextStep: body.suggestedNextStep?.trim() ?? "",
    priority: body.priority,
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
