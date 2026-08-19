import { z } from "zod";
import { listProjectRequirementOptions } from "@/lib/db/local-store";
import { resolveOpenAiCredentials, type OpenAiCredentials } from "@/lib/studio/ai/openai-client";

const matchSchema = z.object({
  requirementId: z.string().nullable(),
  confidence: z.number().min(0).max(1).optional().default(0),
  reason: z.string().optional().default(""),
});

export type RequirementMatchResult = {
  requirementId: string | null;
  confidence: number;
  reason: string;
  method: "openai" | "skipped" | "none";
};

const CONFIDENCE_THRESHOLD = 0.65;

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(payload);
}

/** 有凭证才匹配；无把握返回 null（只挂项目） */
export async function matchRequirementForBug(input: {
  pmProjectId: string;
  title: string;
  description: string;
  pagePath?: string;
  credentials: OpenAiCredentials | null;
}): Promise<RequirementMatchResult> {
  if (!input.credentials?.apiKey?.trim()) {
    return { requirementId: null, confidence: 0, reason: "未配置模型", method: "skipped" };
  }

  const options = await listProjectRequirementOptions(input.pmProjectId);
  const open = options.filter((o) => o.inPool !== false).slice(0, 80);
  if (open.length === 0) {
    return { requirementId: null, confidence: 0, reason: "项目无需求可选", method: "none" };
  }

  const { apiKey, model, baseUrl } = resolveOpenAiCredentials(input.credentials);
  const catalog = open
    .map((o) => `- ${o.id} | ${o.title}`)
    .join("\n");

  const user = [
    `Bug 标题：${input.title}`,
    `描述：${input.description || "（无）"}`,
    input.pagePath ? `页面：${input.pagePath}` : "",
    "",
    "候选需求（id | 标题）：",
    catalog,
    "",
    "请输出 JSON：{ requirementId: string|null, confidence: 0~1, reason: string }",
    "规则：只有高度相关才填 requirementId；不确定必须 requirementId=null。",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "你是产品 Bug 分拣助手。只把 Bug 挂到真正相关的需求上；拿不准就返回 null。",
          },
          { role: "user", content: user },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        requirementId: null,
        confidence: 0,
        reason: `模型调用失败: ${detail.slice(0, 120)}`,
        method: "openai",
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return { requirementId: null, confidence: 0, reason: "模型无内容", method: "openai" };
    }

    const parsed = matchSchema.parse(parseJsonContent(content));
    const id = parsed.requirementId?.trim() || null;
    const allowed = id && open.some((o) => o.id === id) ? id : null;
    const confidence = parsed.confidence ?? 0;

    if (!allowed || confidence < CONFIDENCE_THRESHOLD) {
      return {
        requirementId: null,
        confidence,
        reason: parsed.reason || "置信不足或不匹配",
        method: "openai",
      };
    }

    return {
      requirementId: allowed,
      confidence,
      reason: parsed.reason || "已匹配",
      method: "openai",
    };
  } catch (error) {
    return {
      requirementId: null,
      confidence: 0,
      reason: error instanceof Error ? error.message : "匹配失败",
      method: "openai",
    };
  }
}
