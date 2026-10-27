import { resolveOpenAiCredentials, type OpenAiCredentials } from "@/lib/studio/ai/openai-client";
import {
  applyPartitionToTitle,
  linkedViewTitleHint,
  parseTitleModulePrefix,
  titleUsesModulePrefix,
  type TitleKind,
} from "./title-hints";

export type OptimizeTitleInput = {
  kind: TitleKind;
  title: string;
  l1: string;
  l2: string;
  context?: string;
};

export type OptimizeTitleResult = {
  title: string;
  l1: string;
  l2: string;
  method: "openai" | "rule";
};

function cleanRest(kind: TitleKind, title: string): string {
  let rest = parseTitleModulePrefix(kind, title).rest;
  rest = rest.replace(/\s+/g, " ").trim();
  rest = rest.replace(/^[：:，,。.\-—_]+/, "").trim();
  if (rest === "无标题" || rest === "新页面") rest = "";
  return rest;
}

/** 按已选模块/分区整理前缀；不发明二级。 */
export function polishLinkedViewTitle(input: OptimizeTitleInput): string {
  const l1 = input.l1.trim();
  const l2 = input.l2.trim();
  const rest = cleanRest(input.kind, input.title);
  if (!titleUsesModulePrefix(input.kind)) {
    return rest || input.title.trim();
  }
  if (!l1) return rest;
  return applyPartitionToTitle(input.kind, rest, l1, l2);
}

function allowedL2(input: OptimizeTitleInput, candidate: string): string {
  const given = input.l2.trim();
  if (given) return given;
  const fromTitle = parseTitleModulePrefix(input.kind, input.title).l2;
  const n = candidate.trim();
  if (n && fromTitle && (n === fromTitle || fromTitle.includes(n) || n.includes(fromTitle))) {
    return fromTitle;
  }
  return given;
}

export async function optimizeLinkedViewTitle(
  input: OptimizeTitleInput,
  credentials: OpenAiCredentials | null
): Promise<OptimizeTitleResult> {
  const l1 = input.l1.trim() || parseTitleModulePrefix(input.kind, input.title).l1;
  const l2Seed = input.l2.trim() || parseTitleModulePrefix(input.kind, input.title).l2;
  const ruled = polishLinkedViewTitle({ ...input, l1, l2: l2Seed });

  if (!credentials?.apiKey?.trim()) {
    return { title: ruled, l1, l2: l2Seed, method: "rule" };
  }

  const hint = linkedViewTitleHint(
    input.kind === "optimization" ? "optimization" : input.kind,
    l1
  );
  const { apiKey, model, baseUrl } = resolveOpenAiCredentials(credentials);
  const user = [
    `类型：${input.kind}`,
    `命名格式：${hint.placeholder}`,
    `例子：${hint.example}`,
    `当前名称：${input.title || "（空）"}`,
    `功能模块（一级）：${l1 || "（未选，不要编造）"}`,
    `功能分区（二级）：${l2Seed || "（未填。禁止凭空加二级）"}`,
    input.context?.trim() ? `补充：${input.context.trim().slice(0, 800)}` : "",
    "",
    "只输出 JSON：{ \"title\": string }",
    "规则：",
    "1. 一行中文标题，不解释。",
    "2. 需求/Bug/优化用 [一级] 或 [一级-二级] 前缀；有二级才加二级。",
    "3. PRD 用 PRD-一级-功能名称。",
    "4. 知识点、竞品不加 [模块] 前缀。",
    "5. 不编造原文没有的事实；把口语整理成规范名称。",
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
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "你是产品命名助手，按给定格式改写标题，不发明二级模块。",
          },
          { role: "user", content: user },
        ],
      }),
    });
    if (!response.ok) {
      return { title: ruled, l1, l2: l2Seed, method: "rule" };
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) return { title: ruled, l1, l2: l2Seed, method: "rule" };
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const parsed = JSON.parse(fenced ? fenced[1].trim() : content) as {
      title?: unknown;
    };
    const raw = typeof parsed.title === "string" ? parsed.title.trim() : "";
    if (!raw) return { title: ruled, l1, l2: l2Seed, method: "rule" };
    const fromAi = parseTitleModulePrefix(input.kind, raw);
    const l2 = allowedL2(input, fromAi.l2);
    const title = polishLinkedViewTitle({
      kind: input.kind,
      title: raw,
      l1: l1 || fromAi.l1,
      l2,
    });
    return {
      title: title || ruled,
      l1: l1 || fromAi.l1,
      l2,
      method: "openai",
    };
  } catch {
    return { title: ruled, l1, l2: l2Seed, method: "rule" };
  }
}
