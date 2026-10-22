import { z } from "zod";
import { resolveOpenAiCredentials, type OpenAiCredentials } from "@/lib/studio/ai/openai-client";
import type { BugSeverity, BugType } from "@/lib/types";
import { BUG_TYPE_LABELS } from "@/lib/types";

/** 整理反馈时每条可进 Bug 表或需求池 */
export type FeedbackItemKind = "bug" | "requirement";

export type BugFeedbackDraft = {
  key: string;
  title: string;
  description: string;
  reproSteps: string;
  severity: BugSeverity;
  bugType: BugType;
  /** bug → Bug 表；requirement → 需求池 */
  kind: FeedbackItemKind;
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
        kind: z.enum(["bug", "requirement"]).optional().default("bug"),
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
      .filter(Boolean)
      .find((s) => !isStructuralBugSectionTitle(s)) ??
    body
      .split(/\n/)
      .map((s) => s.trim())
      .find(Boolean) ??
    `问题 ${index + 1}`;
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

/** 大章节标题：Bug 清单 / 需求清单 → 后续条目默认 kind */
export function detectFeedbackSectionKind(line: string): FeedbackItemKind | null {
  const t = line.replace(/^#+\s*/, "").trim();
  if (!t) return null;
  if (/需求清单|功能清单|新需求|功能需求|改进建议/.test(t) && !/bug|缺陷|问题清单/i.test(t)) {
    return "requirement";
  }
  if (/bug\s*清单|缺陷清单|问题清单|缺陷列表/i.test(t)) return "bug";
  if (/^[一二三四五六七八九十\d]+[、.．]\s*.*需求/.test(t) && !/bug|缺陷|问题/.test(t)) {
    return "requirement";
  }
  if (/^[一二三四五六七八九十\d]+[、.．]\s*.*(bug|缺陷|问题)/i.test(t)) return "bug";
  return null;
}

/**
 * 单条归类：章节提示优先；否则看显式标签 / 愿望语气 vs 缺陷语气。
 * 默认 bug（反馈导入历史以缺陷为主）。
 */
export function inferFeedbackKind(
  text: string,
  sectionHint?: FeedbackItemKind | null
): FeedbackItemKind {
  if (sectionHint === "bug" || sectionHint === "requirement") return sectionHint;
  const t = text.trim();
  if (/【\s*需求\s*】|^(✨\s*)?(需求|功能|feature)\s*[:：]/im.test(t)) return "requirement";
  if (/【\s*(bug|缺陷|问题)\s*】|^(🐛\s*)?(bug|缺陷|问题)\s*[:：]/im.test(t)) return "bug";
  const hasRepro = /复现|重现|步骤|实际[：:]|期望[：:]|出现步骤|失效原因/.test(t);
  const wish =
    /希望|想要|能否|可以增加|建议增加|新增|支持|提供|需要一[个种]|做成|接入/.test(t);
  const broken =
    /报错|崩溃|白屏|无法|打不开|异常|失效|错误|泄漏|卡住|显示为\s*0|进不了|看不到|中断/.test(
      t
    );
  if (wish && !hasRepro && !broken) return "requirement";
  if (broken || hasRepro) return "bug";
  return "bug";
}

/** Bug 严重度 → 需求优先级 */
export function severityToRequirementPriority(severity: BugSeverity): string {
  if (severity <= 2) return "P0";
  if (severity === 3) return "P1";
  return "P2";
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

/** 单条 Bug 内部的结构小标题：切段时不要当成新 Bug */
export function isStructuralBugSectionTitle(raw: string): boolean {
  const t = raw
    .trim()
    .replace(/^#+\s*/, "")
    .replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]\s*/, "")
    .replace(/^\d+[\.、．)]\s*/, "")
    .replace(/^[-*•]\s*/, "")
    .replace(/[:：].*$/, "")
    .trim();
  if (!t) return false;
  return /^(复现|重现|出现|期望|实际|描述|步骤|操作步骤|复现步骤|出现步骤|重现步骤|环境|备注|附件|截图|失效原因|原因分析|现象|结果|补充)/i.test(
    t
  );
}

function lineStartsNewBug(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]\s*/.test(t)) {
    return !isStructuralBugSectionTitle(t);
  }
  if (/^(?:bug|问题|缺陷)[:：]\s*/i.test(t)) return true;
  /* 允许「1.标题」无空格（中文常见）；「1. 复现步骤」仍不当新条 */
  if (/^\d+[\.、．)]\s*\S/.test(t)) {
    return !isStructuralBugSectionTitle(t);
  }
  if (/^#{1,3}\s+\S/.test(t)) {
    return !isStructuralBugSectionTitle(t);
  }
  // 列表项常是复现步骤，不当作新 Bug（避免把操作步骤拆碎）
  return false;
}

/** 顶层编号条数（1. / ① / 问题：），用于纠正 AI 合并编号项 */
export function countTopLevelFeedbackItems(raw: string): number {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return 0;
  let n = 0;
  for (const line of text.split("\n")) {
    if (detectFeedbackSectionKind(line)) continue;
    if (lineStartsNewBug(line)) n += 1;
  }
  return n;
}

/** 复现/期望等续写行，或缩进行：无编号回车时不新开一条 */
function isContinuationLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (isStructuralBugSectionTitle(t)) return true;
  if (/^(重现|复现|期望|实际|描述|步骤|环境|备注|见图|截图|补充|操作)[:：]/.test(t)) {
    return true;
  }
  if (/^[→\-–—•]\s+\S/.test(t)) return true;
  if (/^\s+/.test(line) && line.trim().length > 0) return true;
  return false;
}

/**
 * 无编号时：上一块已是单行短句，本行又是新的独立句 → 回车拆成新条。
 * 多行正文中的续写不拆。
 */
function shouldSplitUnnumberedLine(current: string[], line: string): boolean {
  if (!line.trim() || isContinuationLine(line)) return false;
  const body = current.join("\n").trim();
  if (!body) return false;
  const prevLines = body.split("\n").map((s) => s.trim()).filter(Boolean);
  if (prevLines.length !== 1) return false;
  const prev = prevLines[0]!;
  if (prev.length > 160) return false;
  if (line.trim().length > 240) return false;
  return true;
}

/** 首段像「随心而行反馈」导语，而不是一条事项本身 */
function looksLikeFeedbackIntro(part: string): boolean {
  const t = part.trim();
  if (!t || t.includes("\n")) return false;
  if (lineStartsNewBug(t)) return false;
  if (t.length > 36) return false;
  if (/[？?！!]/.test(t)) return false;
  if (/希望|应该|不能|无法|失败|异常|优化|支持|跳转|登录|注册/.test(t)) return false;
  return /反馈|问题汇总|如下|清单|记录|汇总/.test(t) || t.length <= 16;
}

/**
 * 无 AI：按 ①② / 1. / 非结构 ## / 「问题：」切段；
 * 无编号时回车分行也算一条（续写行除外）；
 * 不把「复现步骤 / 期望 / 实际」等结构标题切成多条。
 */
export function parseBugFeedbackHeuristic(raw: string): BugFeedbackPreview {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) {
    return { summary: "", drafts: [], method: "heuristic" };
  }

  const lines = text.split("\n");
  const chunks: Array<{ body: string; sectionKind: FeedbackItemKind | null }> = [];
  let current: string[] = [];
  let sectionKind: FeedbackItemKind | null = null;
  let currentSectionKind: FeedbackItemKind | null = null;

  function flushChunk() {
    const body = current.join("\n").trim();
    if (body) chunks.push({ body, sectionKind: currentSectionKind });
    current = [];
  }

  for (const line of lines) {
    const section = detectFeedbackSectionKind(line);
    if (section) {
      flushChunk();
      sectionKind = section;
      currentSectionKind = section;
      continue;
    }
    if (!line.trim()) {
      flushChunk();
      continue;
    }
    if (current.length === 0) currentSectionKind = sectionKind;
    if (
      current.length > 0 &&
      (lineStartsNewBug(line) || shouldSplitUnnumberedLine(current, line))
    ) {
      flushChunk();
      currentSectionKind = sectionKind;
      current = [line];
    } else {
      current.push(line);
    }
  }
  flushChunk();

  const parts = chunks.map((c) => c.body);
  const kindsFromChunks = chunks.map((c) => c.sectionKind);

  let intro = "";
  let sections = parts;
  let sectionKinds = kindsFromChunks;
  if (parts.length > 1 && looksLikeFeedbackIntro(parts[0]!)) {
    intro = parts[0]!;
    sections = parts.slice(1);
    sectionKinds = kindsFromChunks.slice(1);
  }

  if (sections.length === 0) {
    sections = [text];
    intro = "";
    sectionKinds = [null];
  }

  const drafts: BugFeedbackDraft[] = sections.map((body, i) => {
    const { reproSteps, description } = splitReproAndRest(body);
    const kind = inferFeedbackKind(body, sectionKinds[i] ?? null);
    return {
      key: `h-${i}`,
      title: sectionTitle(body, i),
      description,
      reproSteps,
      severity: inferBugSeverity(body),
      bugType: inferBugType(body),
      kind,
      selected: true,
      imageHints: extractImageHints(body),
    };
  });

  const bugN = drafts.filter((d) => d.kind === "bug").length;
  const reqN = drafts.filter((d) => d.kind === "requirement").length;
  const mix =
    reqN > 0
      ? `整理出 ${drafts.length} 条（Bug ${bugN} · 需求 ${reqN}）`
      : `整理出 ${drafts.length} 条 Bug`;

  return {
    summary: firstLineTitle(intro || text, mix),
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

  const mapAi = (drafts: z.infer<typeof draftSchema>["drafts"]): BugFeedbackDraft[] =>
    drafts.map((d, i) => ({
      key: `ai-${i}`,
      title: d.title.trim().slice(0, 120),
      description: (d.description ?? "").trim().slice(0, 2000),
      reproSteps: (d.reproSteps ?? "").trim().slice(0, 2000),
      severity: (d.severity ?? 3) as BugSeverity,
      bugType: d.bugType ?? "other",
      kind: (d.kind === "requirement" ? "requirement" : "bug") as FeedbackItemKind,
      selected: true,
      imageHints: (d.imageHints ?? []).slice(0, 8),
    }));

  const summarize = (drafts: BugFeedbackDraft[]) => {
    const bugN = drafts.filter((d) => d.kind === "bug").length;
    const reqN = drafts.filter((d) => d.kind === "requirement").length;
    return reqN > 0
      ? `整理出 ${drafts.length} 条（Bug ${bugN} · 需求 ${reqN}）`
      : `整理出 ${drafts.length} 条 Bug`;
  };

  const { apiKey, model, baseUrl } = resolveOpenAiCredentials(opts.credentials);
  const types = Object.keys(BUG_TYPE_LABELS).join("/");
  const names = (opts.imageFileNames ?? []).filter(Boolean).slice(0, 40);

  const prompt = [
    "你是测试/产品助手。把下面这段中文反馈整理成清单：每条标成 Bug（缺陷）或 需求（新功能/改进）。",
    opts.projectTitle ? `关联项目：${opts.projectTitle}` : "",
    names.length
      ? `用户已准备这些截图文件（按上传顺序）：\n${names.map((n, i) => `${i + 1}. ${n}`).join("\n")}`
      : "",
    "",
    "规则：",
    "- **一条独立事项一条**：原文里 1. / 2. / ①② 或「问题：」各自开头的，必须拆成多条 drafts，禁止把下一条塞进上一条的 reproSteps/description",
    "- 若原文有「Bug清单 / 需求清单」分区，严格按分区标 kind",
    "- kind 只能是 bug 或 requirement：已坏/异常/复现 → bug；希望新增能力/改进且非现有缺陷 → requirement",
    "- title 短、可扫读；Bug 写 reproSteps；需求可把说明放 description，reproSteps 可空",
    `- severity 1致命 2严重 3一般 4轻微（需求也可用，映射优先级）；bugType 只能是 ${types}（需求可填 other）`,
    "- imageHints：优先填上面对应的**完整文件名**；若只能推断图序则写 图1 / 图2；不要瞎编不存在的文件名",
    "- 输出 JSON：{ summary, drafts:[{ title, description, reproSteps, severity, bugType, kind, imageHints }] }",
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
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      // 部分兼容端（含部分 DeepSeek 模型）不支持 json_object，失败后外层会回退规则拆分
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Turn messy Chinese product feedback into bugs and requirements. JSON only.",
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
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "Turn messy Chinese product feedback into bugs and requirements. Reply with JSON only, no markdown.",
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
      const draftsRetry = mapAi(parsedRetry.drafts);
      return {
        summary: (parsedRetry.summary || summarize(draftsRetry)).slice(0, 160),
        method: "openai",
        drafts: draftsRetry,
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
  const drafts = mapAi(parsed.drafts);
  return {
    summary: (parsed.summary || summarize(drafts)).slice(0, 160),
    method: "openai",
    drafts,
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
  const heuristic = parseBugFeedbackHeuristic(raw);
  const numbered = countTopLevelFeedbackItems(raw);

  if (opts.preferAi !== false && opts.credentials?.apiKey?.trim()) {
    try {
      const ai = await parseBugFeedbackWithOpenAi(raw, {
        projectTitle: opts.projectTitle,
        credentials: opts.credentials,
        imageFileNames: opts.imageFileNames,
      });
      /* 规则已拆出多条（编号或回车分行），AI 却并成更少条 → 以规则为准 */
      if (
        heuristic.drafts.length >= 2 &&
        ai.drafts.length < heuristic.drafts.length &&
        (numbered >= 2 || numbered === 0)
      ) {
        return {
          ...heuristic,
          method: "heuristic",
          aiError: `AI 只返回 ${ai.drafts.length} 条，已按规则拆成 ${heuristic.drafts.length} 条`,
        };
      }
      return ai;
    } catch (error) {
      const aiError =
        error instanceof Error
          ? /aborted|TimeoutError|timeout/i.test(error.name) ||
            /timeout|aborted/i.test(error.message)
            ? "模型超时（60s），已改用规则拆分"
            : error.message.slice(0, 180)
          : "AI 失败";
      return { ...heuristic, aiError };
    }
  }
  return heuristic;
}
