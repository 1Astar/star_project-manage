import { z } from "zod";
import { resolveOpenAiCredentials, type OpenAiCredentials } from "@/lib/studio/ai/openai-client";
import type { Idea, Project } from "@/lib/studio/types";

const routeActionSchema = z.enum(["to_project", "to_task", "observe", "discard"]);

export const ideaDigestSchema = z.object({
  themes: z.array(z.string().min(1)).max(8),
  clusters: z
    .array(
      z.object({
        title: z.string().min(1),
        ideaIds: z.array(z.string().min(1)).min(1),
      })
    )
    .max(12),
  suggestedRoutes: z
    .array(
      z.object({
        ideaId: z.string().min(1),
        action: routeActionSchema,
        targetProjectId: z.string().nullable().optional(),
        reason: z.string().optional(),
      })
    )
    .max(50),
  stats: z.object({
    newToday: z.number().int().min(0),
    byProject: z.record(z.string(), z.number().int().min(0)),
  }),
});

export type IdeaDigestResult = z.infer<typeof ideaDigestSchema>;

export type DigestIdeasInput = {
  ideas: Idea[];
  projects: Project[];
  dateLabel: string;
};

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(payload);
}

function buildDigestPrompt(input: DigestIdeasInput): string {
  const ideaLines = input.ideas.map((idea) => {
    const project = idea.relatedProjectId
      ? input.projects.find((p) => p.id === idea.relatedProjectId)?.title ?? idea.relatedProjectId
      : "未归属";
    return [
      `- id: ${idea.id}`,
      `  标题: ${idea.title}`,
      `  摘要: ${idea.oneLineIdea || idea.whyItMatters || idea.rawInput || "—"}`,
      `  类型: ${idea.type}`,
      `  优先级: ${idea.priority}`,
      `  项目: ${project}`,
    ].join("\n");
  });

  const projectLines = input.projects.map((p) => `- ${p.id}: ${p.title}（${p.status}）`);

  return [
    "你是 Star PM 的产品经理助手，帮助整理一天内随手记录的碎片化灵感。",
    `目标日期：${input.dateLabel}`,
    `共 ${input.ideas.length} 条灵感待整理。`,
    "",
    "【可选项目】",
    projectLines.length > 0 ? projectLines.join("\n") : "（无项目）",
    "",
    "【今日灵感列表】",
    ideaLines.join("\n"),
    "",
    "请输出 JSON，字段与 schema 完全一致：",
    "1. themes: 2–5 个今日主题关键词（中文）",
    "2. clusters: 将相关灵感聚类，每条 cluster 有 title 与 ideaIds（必须用上方列表中的 id）",
    "3. suggestedRoutes: 为每条灵感建议去向",
    "   - action: to_project | to_task | observe | discard",
    "   - to_project / to_task 时填 targetProjectId（用项目 id）；observe / discard 可 null",
    "   - 可选 reason 一句话说明",
    "4. stats: newToday 为今日灵感总数；byProject 为各项目 id 下的条数（未归属不计入或记 __none__）",
    "5. 只输出 JSON，不要 markdown",
  ].join("\n");
}

function computeStats(ideas: Idea[]): IdeaDigestResult["stats"] {
  const byProject: Record<string, number> = {};
  for (const idea of ideas) {
    const key = idea.relatedProjectId ?? "__none__";
    byProject[key] = (byProject[key] ?? 0) + 1;
  }
  return {
    newToday: ideas.length,
    byProject,
  };
}

export async function digestIdeasWithOpenAi(
  input: DigestIdeasInput,
  credentials: OpenAiCredentials
): Promise<IdeaDigestResult> {
  const stats = computeStats(input.ideas);

  if (input.ideas.length === 0) {
    return {
      themes: ["今日暂无新灵感"],
      clusters: [],
      suggestedRoutes: [],
      stats,
    };
  }

  const { apiKey, model, baseUrl } = resolveOpenAiCredentials(credentials);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You cluster product ideas for a Chinese PM tool. Always respond with valid JSON matching the requested schema keys exactly. Use only idea ids from the user list.",
        },
        { role: "user", content: buildDigestPrompt(input) },
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

  const parsed = parseJsonContent(content);
  const result = ideaDigestSchema.parse(parsed);

  return {
    ...result,
    stats,
  };
}
