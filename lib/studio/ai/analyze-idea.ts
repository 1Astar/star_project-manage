import { z } from "zod";
import { resolveOpenAiCredentials, type OpenAiCredentials } from "@/lib/studio/ai/openai-client";
import type { Idea, IdeaSubtask, IdeaType, EmotionLevel, IdeaPriority } from "@/lib/studio/types";

const prioritySchema = z.enum(["P0", "P1", "P2", "P3"]);
const ideaTypeSchema = z.enum(["product", "feature", "ui", "content", "tech", "business"]);
const emotionSchema = z.enum(["normal", "like", "excited"]);
const actionSchema = z.enum(["inbox", "park"]);

const scoreSchema = z.object({
  score: z.number().min(1).max(5),
  summary: z.string().min(1),
});

export const ideaAnalysisSchema = z.object({
  title: z.string().min(1),
  oneLineIdea: z.string().min(1),
  whyItMatters: z.string().min(1),
  type: ideaTypeSchema,
  emotionLevel: emotionSchema,
  priority: prioritySchema,
  triggerSource: z.string(),
  suggestedAction: actionSchema,
  reasoning: z.string().min(1),
  feasibility: scoreSchema,
  competitiveness: scoreSchema,
  subtasks: z
    .array(
      z.object({
        title: z.string().min(1),
        priority: prioritySchema,
        rationale: z.string().min(1),
      })
    )
    .min(2)
    .max(8),
});

export type IdeaAnalysisResult = z.infer<typeof ideaAnalysisSchema>;

export type { OpenAiCredentials };

export type AnalyzeIdeaContext = {
  rawInput: string;
  whyThought?: string;
  emotionLevel?: EmotionLevel;
  preferPark?: boolean;
  relatedProject?: {
    title: string;
    positioning: string;
    status: string;
    priority: string;
    nextAction: string;
  } | null;
  relatedIdea?: Pick<Idea, "title" | "oneLineIdea" | "whyItMatters" | "priority" | "type"> | null;
};

function buildContextBlock(context: AnalyzeIdeaContext): string {
  const lines: string[] = [];

  if (context.whyThought?.trim()) {
    lines.push("【用户补充：为什么突然想到】", context.whyThought.trim(), "");
  }
  if (context.emotionLevel) {
    lines.push(`【用户情绪强度】${context.emotionLevel}`, "");
  }
  if (context.preferPark) {
    lines.push("【用户倾向】希望先放进停车场，短期不做", "");
  }

  if (context.relatedProject) {
    const p = context.relatedProject;
    lines.push(
      "【关联项目】",
      `- 标题：${p.title}`,
      `- 定位：${p.positioning || "（空）"}`,
      `- 状态：${p.status}`,
      `- 项目优先级：${p.priority}`,
      `- 下一步：${p.nextAction || "（空）"}`
    );
  } else if (context.relatedIdea) {
    const i = context.relatedIdea;
    lines.push(
      "【关联灵感】",
      `- 标题：${i.title}`,
      `- 一句话：${i.oneLineIdea}`,
      `- 为什么：${i.whyItMatters}`,
      `- 类型：${i.type}`,
      `- 当前优先级：${i.priority}`
    );
  } else {
    lines.push("【关联上下文】无（独立新灵感）");
  }

  return lines.join("\n");
}

function buildPrompt(context: AnalyzeIdeaContext): string {
  return [
    "你是 Starry Product Lab 的产品经理助手，帮助整理突发灵感。",
    "团队同时推进 AI 宠物、AI 控制器、Star PM / Idea Studio 等多条产品线，资源有限。",
    "",
    buildContextBlock(context),
    "",
    "【用户原始输入】",
    context.rawInput.trim(),
    "",
    "请输出 JSON，要求：",
    "1. 提炼 title / oneLineIdea / whyItMatters / type / emotionLevel / triggerSource",
    "2. 为整条灵感定 priority（P0 紧急且高价值 … P3 可延后）",
    "3. 拆 2–8 条可执行 subtasks，每条带 priority 与 rationale",
    "4. reasoning 用 2–4 句中文说明优先级判断依据（结合关联上下文与团队资源）",
    "5. feasibility：实现性评估（score 1–5，summary 2–3 句：技术难度、资源、现有基础）",
    "6. competitiveness：竞争力评估（score 1–5，summary 2–3 句：差异化、市场、竞品）",
    "7. suggestedAction：inbox（默认进收件箱）或 park（明显偏离主线、短期不做）；若用户倾向停车则优先 park",
    "8. 若已关联项目，子任务应可落地到该项目；若关联灵感，子任务应推进该灵感",
    "9. 只输出 JSON，字段名与 schema 完全一致，不要 markdown",
  ].join("\n");
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(payload);
}

export async function analyzeIdeaWithOpenAi(
  context: AnalyzeIdeaContext,
  credentials: OpenAiCredentials
): Promise<IdeaAnalysisResult> {
  const { apiKey, model, baseUrl } = resolveOpenAiCredentials(credentials);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You structure product ideas for a Chinese PM tool. Always respond with valid JSON matching the requested schema keys exactly.",
        },
        { role: "user", content: buildPrompt(context) },
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
  return ideaAnalysisSchema.parse(parsed);
}

export function toIdeaSubtasks(subtasks: IdeaAnalysisResult["subtasks"]): IdeaSubtask[] {
  return subtasks.map((item) => ({
    title: item.title.trim(),
    priority: item.priority as IdeaPriority,
    rationale: item.rationale.trim(),
  }));
}

export function analysisToDraft(
  analysis: IdeaAnalysisResult,
  rawInput: string
): Pick<
  Idea,
  | "title"
  | "oneLineIdea"
  | "whyItMatters"
  | "triggerSource"
  | "emotionLevel"
  | "type"
  | "priority"
  | "rawInput"
  | "subtasks"
  | "status"
> {
  return {
    title: analysis.title.trim(),
    oneLineIdea: analysis.oneLineIdea.trim(),
    whyItMatters: analysis.whyItMatters.trim(),
    triggerSource: analysis.triggerSource.trim() || "AI 拆解",
    emotionLevel: analysis.emotionLevel as EmotionLevel,
    type: analysis.type as IdeaType,
    priority: analysis.priority as IdeaPriority,
    rawInput: rawInput.trim(),
    subtasks: toIdeaSubtasks(analysis.subtasks),
    status: analysis.suggestedAction === "park" ? "parked" : "inbox",
  };
}
