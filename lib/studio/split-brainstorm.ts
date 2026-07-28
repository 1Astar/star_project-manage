import { z } from "zod";
import { resolveOpenAiCredentials, type OpenAiCredentials } from "@/lib/studio/ai/openai-client";
import type { TaskPriority } from "@/lib/studio/types";

export type SplitTaskDraft = {
  key: string;
  title: string;
  priority: TaskPriority;
  module: string;
  progressNote: string;
  selected: boolean;
};

export type SplitBrainstormPreview = {
  parentTitle: string;
  parentSummary: string;
  tasks: SplitTaskDraft[];
  method: "heuristic" | "openai";
};

const draftSchema = z.object({
  parentTitle: z.string().min(1),
  parentSummary: z.string().optional().default(""),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1),
        priority: z.enum(["P0", "P1", "P2", "P3"]).optional().default("P2"),
        module: z.string().optional().default(""),
        progressNote: z.string().optional().default(""),
      })
    )
    .min(1)
    .max(40),
});

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(payload);
}

function firstLineTitle(text: string, fallback: string): string {
  const line =
    text
      .split(/\n/)
      .map((s) => s.trim())
      .find(Boolean) ?? fallback;
  return line.replace(/^#+\s*/, "").slice(0, 80) || fallback;
}

function sectionTitle(body: string, index: number): string {
  const line =
    body
      .split(/\n/)
      .map((s) => s.trim())
      .find(Boolean) ?? `任务 ${index + 1}`;
  return line
    .replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]\s*/, "")
    .replace(/^\d+[\.、．)]\s*/, "")
    .replace(/^[-*•]\s*/, "")
    .replace(/^#+\s*/, "")
    .slice(0, 80);
}

/**
 * 无 AI：按 ①② / 1. / ## 标题切段，适合「五大体系」这类脑暴。
 */
export function splitBrainstormHeuristic(raw: string): SplitBrainstormPreview {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) {
    return {
      parentTitle: "未命名脑暴",
      parentSummary: "",
      tasks: [],
      method: "heuristic",
    };
  }

  const marker =
    /(?:^|\n)(?=(?:[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]\s)|(?:#{1,3}\s+\S)|(?:\d+[\.、．)]\s+\S))/g;
  const parts = text.split(marker).map((p) => p.trim()).filter(Boolean);

  let intro = "";
  let sections = parts;
  if (parts.length > 1 && !/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]|^#{1,3}\s|^\d+[\.、．)]\s/.test(parts[0])) {
    intro = parts[0];
    sections = parts.slice(1);
  }

  if (sections.length === 0) {
    sections = [text];
    intro = "";
  }

  const parentTitle = firstLineTitle(intro || text, "脑暴拆条");
  const tasks: SplitTaskDraft[] = sections.map((body, i) => ({
    key: `h-${i}`,
    title: sectionTitle(body, i),
    priority: "P2" as TaskPriority,
    module: "",
    progressNote: body.slice(0, 500),
    selected: true,
  }));

  return {
    parentTitle,
    parentSummary: intro.slice(0, 400) || parentTitle,
    tasks,
    method: "heuristic",
  };
}

export async function splitBrainstormWithOpenAi(
  raw: string,
  opts: {
    projectTitle?: string;
    featureModules?: string[];
    credentials: OpenAiCredentials;
  }
): Promise<SplitBrainstormPreview> {
  const text = raw.trim();
  if (!text) return splitBrainstormHeuristic(raw);

  const { apiKey, model, baseUrl } = resolveOpenAiCredentials(opts.credentials);
  const modules = (opts.featureModules ?? []).slice(0, 60);

  const prompt = [
    "你是产品经理助手。把下面这段中文脑暴拆成：1 条父灵感标题/摘要 + 多条可执行任务。",
    opts.projectTitle ? `关联项目：${opts.projectTitle}` : "",
    modules.length ? `可用板块（尽量选用，否则留空）：\n${modules.map((m) => `- ${m}`).join("\n")}` : "",
    "",
    "规则：",
    "- 任务标题短、可勾选完成（不要整段复制）",
    "- progressNote 可保留关键原文要点",
    "- priority 用 P0/P1/P2/P3",
    "- 输出 JSON：{ parentTitle, parentSummary, tasks:[{ title, priority, module, progressNote }] }",
    "",
    "【脑暴原文】",
    text.slice(0, 12000),
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Split Chinese product brainstorms into actionable tasks. Respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI 请求失败 (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI 返回为空");

  const parsed = draftSchema.parse(parseJsonContent(content));
  return {
    parentTitle: parsed.parentTitle.trim().slice(0, 120),
    parentSummary: (parsed.parentSummary ?? "").trim().slice(0, 500),
    method: "openai",
    tasks: parsed.tasks.map((t, i) => ({
      key: `ai-${i}`,
      title: t.title.trim().slice(0, 120),
      priority: t.priority ?? "P2",
      module: (t.module ?? "").trim(),
      progressNote: (t.progressNote ?? "").trim().slice(0, 800),
      selected: true,
    })),
  };
}

export async function previewSplitBrainstorm(
  raw: string,
  opts: {
    projectTitle?: string;
    featureModules?: string[];
    credentials?: OpenAiCredentials | null;
    preferAi?: boolean;
  }
): Promise<SplitBrainstormPreview> {
  if (opts.preferAi !== false && opts.credentials?.apiKey?.trim()) {
    try {
      return await splitBrainstormWithOpenAi(raw, {
        projectTitle: opts.projectTitle,
        featureModules: opts.featureModules,
        credentials: opts.credentials,
      });
    } catch {
      /* fall through to heuristic */
    }
  }
  return splitBrainstormHeuristic(raw);
}
