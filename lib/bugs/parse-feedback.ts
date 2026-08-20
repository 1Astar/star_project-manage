import { z } from "zod";
import { resolveOpenAiCredentials, type OpenAiCredentials } from "@/lib/studio/ai/openai-client";
import type { BugSeverity, BugType } from "@/lib/types";
import { BUG_TYPE_LABELS } from "@/lib/types";

export type BugFeedbackDraft = {
  key: string;
  title: string;
  description: string;
  reproSteps: string;
  severity: BugSeverity;
  bugType: BugType;
  selected: boolean;
  imageHints: string[];
};

export type BugFeedbackPreview = {
  summary: string;
  drafts: BugFeedbackDraft[];
  method: "heuristic" | "openai";
  /** AI 失败时的原因；仍可能返回 heuristic 草稿 */
  aiError?: string;
};

const draftSchema = z.object({
  summary: z.string().optional().default(""),
  drafts: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional().default(""),
        reproSteps: z.string().optional().default(""),
        severity: z.number().int().min(1).max(4).optional().default(3),
        bugType: z
          .enum([
            "code",
            "ui",
            "performance",
            "security",
            "design",
            "config",
            "install",
            "other",
          ])
          .optional()
          .default("other"),
        imageHints: z.array(z.string()).optional().default([]),
      })
    )
    .min(1)
    .max(80),
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
      .find(Boolean) ?? `问题 ${index + 1}`;
  return line
    .replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]\s*/, "")
    .replace(/^\d+[\.、．)]\s*/, "")
    .replace(/^[-*•]\s*/, "")
    .replace(/^#+\s*/, "")
    .replace(/^(bug|问题|缺陷)[:：]\s*/i, "")
    .replace(/^【([^】]+)】\s*/, "$1 ")
    .slice(0, 80);
}

export function inferBugSeverity(text: string): BugSeverity {
  if (/致命|崩溃|闪退|白屏|数据丢失|无法使用|打不开应用/.test(text)) return 1;
  if (/严重|阻塞|登录不了|完全不能|必现/.test(text)) return 2;
  if (/轻微|文案|错字|提示语|间距/.test(text)) return 4;
  return 3;
}

export function inferBugType(text: string): BugType {
  if (/安全|权限|泄漏|注入|越权/.test(text)) return "security";
  if (/卡顿|很卡|很慢|内存|性能|加载久|加载很/.test(text)) return "performance";
  if (/安装|部署|构建失败|打包/.test(text)) return "install";
  if (/配置|环境变量|开关|feature flag/.test(text)) return "config";
  if (/设计稿|交互稿|视觉规范/.test(text)) return "design";
  if (/界面|按钮|样式|布局|字体|颜色|对齐|遮挡|滚动/.test(text)) return "ui";
  if (/报错|exception|500|接口|空指针|undefined/.test(text)) return "code";
  return "other";
}

const CN_NUM: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function parseOrdinal(raw: string): number | null {
  const s = raw.trim();
  if (/^\d+$/.test(s)) return Number(s);
  if (CN_NUM[s]) return CN_NUM[s];
  return null;
}

/** 从「见图1 / 图2 / 截图三」抽出 1-based 图序 */
export function parseImageHintIndexes(text: string): number[] {
  const found: number[] = [];
  const re =
    /(?:见图|见截图|截图|图片|图)\s*([0-9一二三四五六七八九十]+)/g;
  for (const m of text.matchAll(re)) {
    const n = parseOrdinal(m[1] ?? "");
    if (n && n > 0) found.push(n);
  }
  return [...new Set(found)];
}

function extractImageHints(body: string): string[] {
  const hints: string[] = [];
  const md = body.matchAll(/!\[[^\]]*]\(([^)]+)\)/g);
  for (const m of md) {
    if (m[1]) hints.push(m[1]);
  }
  for (const n of parseImageHintIndexes(body)) {
    hints.push(`图${n}`);
  }
  if (/\[图片]|【图】|截图|见图/.test(body) && hints.length === 0) {
    hints.push("对话附图");
  }
  return [...new Set(hints)].slice(0, 8);
}

function splitReproAndRest(body: string): { reproSteps: string; description: string } {
  const reproMatch = body.match(
    /(?:重现|复现|步骤)[:：]\s*([\s\S]*?)(?=(?:期望|实际|描述)[:：]|$)/i
  );
  const descMatch = body.match(/(?:期望|实际|描述)[:：]\s*([\s\S]*)$/i);
  const reproSteps = (reproMatch?.[1] ?? "").trim();
  let description = (descMatch?.[1] ?? "").trim();
  if (!reproSteps && !description) {
    const lines = body.split(/\n/).map((s) => s.trim()).filter(Boolean);
    description = lines.slice(1).join("\n");
  }
  return { reproSteps, description };
}

/**
 * 无 AI：按 ①② / 1. / ## / 「问题：」切段，适合聊天里丢一堆反馈。
 */
export function parseBugFeedbackHeuristic(raw: string): BugFeedbackPreview {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) {
    return { summary: "", drafts: [], method: "heuristic" };
  }

  const marker =
    /(?:^|\n)(?=(?:[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]\s)|(?:#{1,3}\s+\S)|(?:\d+[\.、．)]\s+\S)|(?:[-*•]\s+\S)|(?:(?:bug|问题|缺陷)[:：]\s))/gi;
  const parts = text.split(marker).map((p) => p.trim()).filter(Boolean);

  let intro = "";
  let sections = parts;
  if (
    parts.length > 1 &&
    !/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]|^#{1,3}\s|^\d+[\.、．)]\s|^[-*•]\s|^(?:bug|问题|缺陷)[:：]/i.test(
      parts[0]
    )
  ) {
    intro = parts[0];
    sections = parts.slice(1);
  }

  if (sections.length === 0) {
    sections = [text];
    intro = "";
  }

  const drafts: BugFeedbackDraft[] = sections.map((body, i) => {
    const { reproSteps, description } = splitReproAndRest(body);
    return {
      key: `h-${i}`,
      title: sectionTitle(body, i),
      description,
      reproSteps,
      severity: inferBugSeverity(body),
      bugType: inferBugType(body),
      selected: true,
      imageHints: extractImageHints(body),
    };
  });

  return {
    summary: firstLineTitle(intro || text, `整理出 ${drafts.length} 条 Bug`),
    drafts,
    method: "heuristic",
  };
}

export async function parseBugFeedbackWithOpenAi(
  raw: string,
  opts: {
    projectTitle?: string;
    credentials: OpenAiCredentials;
    /** 用户已选截图文件名，便于 AI 在 imageHints 里直接填文件名 */
    imageFileNames?: string[];
  }
): Promise<BugFeedbackPreview> {
  const text = raw.trim();
  if (!text) return parseBugFeedbackHeuristic(raw);

  const { apiKey, model, baseUrl } = resolveOpenAiCredentials(opts.credentials);
  const types = Object.keys(BUG_TYPE_LABELS).join("/");
  const names = (opts.imageFileNames ?? []).filter(Boolean).slice(0, 40);

  const prompt = [
    "你是测试/产品助手。把下面这段中文反馈（可能含聊天记录、多条问题、截图说明）整理成 Bug 清单。",
    opts.projectTitle ? `关联项目：${opts.projectTitle}` : "",
    names.length
      ? `用户已准备这些截图文件（按上传顺序）：\n${names.map((n, i) => `${i + 1}. ${n}`).join("\n")}`
      : "",
    "",
    "规则：",
    "- 一条独立问题一条 Bug，不要把整段糊成一条",
    "- title 短、可扫读；reproSteps 写怎么点出来；description 写期望 vs 实际",
    `- severity 1致命 2严重 3一般 4轻微；bugType 只能是 ${types}`,
    "- imageHints：优先填上面对应的**完整文件名**；若只能推断图序则写 图1 / 图2；不要瞎编不存在的文件名",
    "- 输出 JSON：{ summary, drafts:[{ title, description, reproSteps, severity, bugType, imageHints }] }",
    "",
    "【反馈原文】",
    text.slice(0, 14000),
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      // 部分兼容端（含部分 DeepSeek 模型）不支持 json_object，失败后外层会回退规则拆分
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Turn messy Chinese bug feedback into a structured bug list. JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    // 不支持 response_format 时去掉再试一次
    if (/response_format|json_object|not support/i.test(detail)) {
      const retry = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "Turn messy Chinese bug feedback into a structured bug list. Reply with JSON only, no markdown.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!retry.ok) {
        const detail2 = await retry.text();
        throw new Error(`OpenAI 请求失败 (${retry.status}): ${detail2.slice(0, 200)}`);
      }
      const payloadRetry = (await retry.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const contentRetry = payloadRetry.choices?.[0]?.message?.content;
      if (!contentRetry) throw new Error("OpenAI 返回为空");
      const parsedRetry = draftSchema.parse(parseJsonContent(contentRetry));
      return {
        summary: (parsedRetry.summary || `整理出 ${parsedRetry.drafts.length} 条 Bug`).slice(
          0,
          160
        ),
        method: "openai",
        drafts: parsedRetry.drafts.map((d, i) => ({
          key: `ai-${i}`,
          title: d.title.trim().slice(0, 120),
          description: (d.description ?? "").trim().slice(0, 2000),
          reproSteps: (d.reproSteps ?? "").trim().slice(0, 2000),
          severity: (d.severity ?? 3) as BugSeverity,
          bugType: d.bugType ?? "other",
          selected: true,
          imageHints: (d.imageHints ?? []).slice(0, 8),
        })),
      };
    }
    throw new Error(`OpenAI 请求失败 (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI 返回为空");

  const parsed = draftSchema.parse(parseJsonContent(content));
  return {
    summary: (parsed.summary || `整理出 ${parsed.drafts.length} 条 Bug`).slice(0, 160),
    method: "openai",
    drafts: parsed.drafts.map((d, i) => ({
      key: `ai-${i}`,
      title: d.title.trim().slice(0, 120),
      description: (d.description ?? "").trim().slice(0, 2000),
      reproSteps: (d.reproSteps ?? "").trim().slice(0, 2000),
      severity: (d.severity ?? 3) as BugSeverity,
      bugType: d.bugType ?? "other",
      selected: true,
      imageHints: (d.imageHints ?? []).slice(0, 8),
    })),
  };
}

const CN_ORD: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function parseImageOrdinal(raw: string): number | null {
  const s = raw.trim();
  if (/^\d+$/.test(s)) return Number(s);
  if (CN_ORD[s]) return CN_ORD[s];
  return null;
}

function resolveHintToFile(
  hint: string,
  fileNames: string[],
  byOrdinal: Map<number, string>,
  used: Set<string>
): string | null {
  const h = hint.trim();
  if (!h) return null;
  const exact = fileNames.find((f) => f === h && !used.has(f));
  if (exact) return exact;
  const byBase = fileNames.find(
    (f) => !used.has(f) && (f === h || f.endsWith(h) || h.endsWith(f) || f.includes(h))
  );
  if (byBase && h.length >= 3) return byBase;
  const ord = [...h.matchAll(/(?:见图|截图|图片|图)\s*([0-9一二三四五六七八九十]+)/g)];
  for (const m of ord) {
    const n = parseImageOrdinal(m[1] ?? "");
    if (!n) continue;
    const file = byOrdinal.get(n) ?? fileNames[n - 1];
    if (file && !used.has(file)) return file;
  }
  const bare = parseImageOrdinal(h.replace(/^图/, ""));
  if (bare) {
    const file = byOrdinal.get(bare) ?? fileNames[bare - 1];
    if (file && !used.has(file)) return file;
  }
  return null;
}

/** 优先 imageHints 里的文件名；其次「见图1」/文件名「图1」；对不上则条数相等时一对一 */
export function matchImagesToDrafts(
  drafts: Array<Pick<BugFeedbackDraft, "key" | "title" | "description" | "reproSteps" | "imageHints">>,
  fileNames: string[]
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  if (!fileNames.length || !drafts.length) return map;

  const byOrdinal = new Map<number, string>();
  fileNames.forEach((name, i) => {
    const m = name.match(/(?:图|img|image|screenshot)[-_\s]*(\d+)/i);
    if (m) byOrdinal.set(Number(m[1]), name);
    else byOrdinal.set(i + 1, byOrdinal.get(i + 1) ?? name);
  });

  const used = new Set<string>();
  drafts.forEach((d, i) => {
    const names: string[] = [];
    for (const hint of d.imageHints ?? []) {
      const file = resolveHintToFile(hint, fileNames, byOrdinal, used);
      if (file) {
        names.push(file);
        used.add(file);
      }
    }
    if (names.length === 0) {
      const blob = `${d.title}\n${d.description}\n${d.reproSteps}`;
      const hinted = [...blob.matchAll(/(?:见图|截图|图片|图)\s*([0-9一二三四五六七八九十]+)/g)];
      for (const h of hinted) {
        const file = resolveHintToFile(`图${h[1]}`, fileNames, byOrdinal, used);
        if (file) {
          names.push(file);
          used.add(file);
        }
      }
    }
    if (names.length === 0 && fileNames.length === drafts.length) {
      const file = fileNames[i];
      if (file && !used.has(file)) {
        names.push(file);
        used.add(file);
      }
    }
    if (names.length) map[d.key] = names;
  });
  return map;
}

export async function previewBugFeedback(
  raw: string,
  opts: {
    projectTitle?: string;
    credentials?: OpenAiCredentials | null;
    preferAi?: boolean;
    imageFileNames?: string[];
  }
): Promise<BugFeedbackPreview> {
  if (opts.preferAi !== false && opts.credentials?.apiKey?.trim()) {
    try {
      return await parseBugFeedbackWithOpenAi(raw, {
        projectTitle: opts.projectTitle,
        credentials: opts.credentials,
        imageFileNames: opts.imageFileNames,
      });
    } catch (error) {
      const aiError =
        error instanceof Error
          ? /aborted|TimeoutError|timeout/i.test(error.name) ||
            /timeout|aborted/i.test(error.message)
            ? "模型超时（25s），已改用规则拆分"
            : error.message.slice(0, 180)
          : "AI 失败";
      const fallback = parseBugFeedbackHeuristic(raw);
      return { ...fallback, aiError };
    }
  }
  return parseBugFeedbackHeuristic(raw);
}
