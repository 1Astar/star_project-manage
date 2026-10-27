import { resolveOpenAiCredentials, type OpenAiCredentials } from "@/lib/studio/ai/openai-client";
import { joinPageProps, splitPageProps } from "@/lib/wiki-pages/page-props";
import {
  PRODUCT_TEST_ANALYST_SYSTEM,
  type AiBugDirection,
  type AiTestAnalysisJson,
  type AiTestDirection,
  type AiTestTaskDetail,
} from "@/lib/modules/test-task-prompt";

export type InvestigationAiSections = AiTestAnalysisJson;

export type GenerateInvestigationInput = {
  pageTitle: string;
  /** 产品模块，如 文件管理 / 任务中心 */
  moduleName?: string;
  /** 功能目标 */
  featureGoal?: string;
  /** 兼容旧字段：页面/功能描述；可与 featureGoal 合并 */
  pageDescription: string;
  /** 已观察到的功能（换行或逗号分隔也可） */
  observedFeatures?: string;
  /** 已观察到的异常：截图说明、操作过程、实际结果 */
  observedAnomalies?: string;
  currentBody: string;
  revisionNote?: string;
  mode: "generate" | "regenerate";
};

export type GenerateInvestigationResult = {
  body: string;
  sections: InvestigationAiSections;
  method: "openai" | "rule";
};

const AI_HEADINGS = [
  "功能目标",
  "已观察到的功能",
  "已观察到的异常",
  "功能拆解",
  "测试方向",
  "调查任务",
  "测试任务",
  "可能的 Bug 方向",
  "待研发确认规则",
  "测试范围缺口",
] as const;

export function isInvestigationPage(title: string, markdown: string): boolean {
  const t = title.trim();
  if (/调查|测试任务/.test(t)) return true;
  return (
    /##\s*调查任务/.test(markdown) ||
    /##\s*测试任务/.test(markdown) ||
    /##\s*功能目标/.test(markdown)
  );
}

export function extractH2Section(markdown: string, heading: string): string {
  const re = new RegExp(
    `##\\s*${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
    "i"
  );
  const m = markdown.match(re);
  return m?.[1]?.trim() ?? "";
}

export function extractChecklistItems(sectionBody: string): string[] {
  const items: string[] = [];
  for (const line of sectionBody.split("\n")) {
    const m = line.match(/^\s*-\s*\[[ xX]\]\s*(.+)$/);
    if (m?.[1]?.trim()) items.push(m[1].trim());
  }
  return items;
}

export function checklistMarkdown(items: string[]): string {
  const list = items.map((t) => t.trim()).filter(Boolean);
  if (list.length === 0) return "- [ ] （待补充）";
  return list.map((t) => `- [ ] ${t}`).join("\n");
}

function bulletMarkdown(items: string[]): string {
  const list = items.map((t) => t.trim()).filter(Boolean);
  if (list.length === 0) return "- （暂无）";
  return list.map((t) => `- ${t}`).join("\n");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitLines(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/\n|；|;/)
    .map((s) => s.replace(/^[\-\*•]\s*/, "").trim())
    .filter(Boolean);
}

/** 替换或插入指定 ## 小节；其它章节与 star-view 原样保留。 */
export function replaceH2Section(
  markdown: string,
  heading: string,
  newBody: string
): string {
  const body = newBody.trim();
  const block = `## ${heading}\n\n${body}`;
  const re = new RegExp(
    `##\\s*${escapeRegExp(heading)}\\s*\\n[\\s\\S]*?(?=\\n##\\s|$)`,
    "i"
  );
  if (re.test(markdown)) {
    return markdown.replace(re, () => `${block}\n`);
  }
  const recordRe = /\n##\s*测试记录\b/i;
  if (recordRe.test(markdown)) {
    return markdown.replace(recordRe, `\n${block}\n\n## 测试记录`);
  }
  const trimmed = markdown.trim();
  return trimmed ? `${block}\n\n${trimmed}` : `${block}\n`;
}

function formatTestDirections(dirs: AiTestDirection[]): string {
  if (!dirs.length) return "- （暂无）";
  return dirs
    .map((d, i) => {
      const title = d.title.trim() || `方向 ${i + 1}`;
      return [
        `### ${i + 1}. ${title}`,
        `- **推导来源：** ${d.derivedFrom.trim() || "（未说明）"}`,
        `- **为何要测：** ${d.why.trim() || "（未说明）"}`,
        `- **关联模块/功能：** ${d.relatedModule.trim() || "（未说明）"}`,
        `- **可能暴露：** ${d.mayExpose.trim() || "（未说明）"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatTestTasks(tasks: AiTestTaskDetail[]): string {
  if (!tasks.length) return "- [ ] （待补充）";
  return tasks
    .map((t, i) => {
      const title = t.title.trim() || `任务 ${i + 1}`;
      const steps = (t.steps ?? [])
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s, j) => `  ${j + 1}. ${s}`)
        .join("\n");
      return [
        `### ${i + 1}. ${title}`,
        "",
        `- [ ] 执行本任务`,
        `- **测试目的：** ${t.purpose.trim() || "（未说明）"}`,
        `- **前置条件：** ${t.preconditions.trim() || "（未说明）"}`,
        `- **操作步骤：**`,
        steps || "  1. （待补充）",
        `- **预期结果：** ${t.expected.trim() || "（未说明）"}`,
        `- **可能暴露的问题：** ${t.mayExpose.trim() || "（未说明）"}`,
        `- **所属问题类型：** ${t.issueType.trim() || "测试任务"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatBugDirections(bugs: AiBugDirection[]): string {
  if (!bugs.length) {
    return "未复现前不记为 Bug。下列仅为**待验证风险 / 可能方向**，需复现后再入库。\n\n- （暂无）";
  }
  const lines = bugs.map((b) => {
    const cat = /已确认\s*Bug/i.test(b.category) ? "待验证风险" : b.category.trim() || "待验证风险";
    return `- **[${cat}]** ${b.title.trim()}${b.note.trim() ? ` — ${b.note.trim()}` : ""}`;
  });
  return [
    "未复现前不记为 Bug。下列仅为**待验证风险 / 可能方向**，需复现后再入库。",
    "",
    ...lines,
  ].join("\n");
}

export function mergeInvestigationSections(
  currentBody: string,
  sections: InvestigationAiSections
): string {
  const { props, markdown } = splitPageProps(currentBody);
  let md = markdown;
  md = replaceH2Section(md, "功能目标", sections.goal.trim() || "（待补充功能目标）");
  md = replaceH2Section(md, "已观察到的功能", checklistMarkdown(sections.observed));
  md = replaceH2Section(
    md,
    "已观察到的异常",
    sections.observedAnomalies.length
      ? bulletMarkdown(sections.observedAnomalies)
      : "- （暂无；有截图/实际结果时补上）"
  );
  md = replaceH2Section(md, "功能拆解", bulletMarkdown(sections.featureBreakdown));
  md = replaceH2Section(md, "测试方向", formatTestDirections(sections.testDirections));
  md = replaceH2Section(md, "调查任务", checklistMarkdown(sections.investigate));
  md = replaceH2Section(md, "测试任务", formatTestTasks(sections.testTasks));
  md = replaceH2Section(md, "可能的 Bug 方向", formatBugDirections(sections.bugDirections));
  md = replaceH2Section(md, "待研发确认规则", bulletMarkdown(sections.rulesToConfirm));
  md = replaceH2Section(md, "测试范围缺口", bulletMarkdown(sections.coverageGaps));
  return joinPageProps(props, md.trim() + "\n");
}

export function seedDescriptionFromBody(currentBody: string, pageTitle: string): string {
  const { markdown } = splitPageProps(currentBody);
  const goal = extractH2Section(markdown, "功能目标");
  if (goal) return goal.replace(/\s+/g, " ").trim();
  const title = pageTitle.trim();
  if (title) return `围绕「${title}」做功能调查与测试。`;
  return "";
}

export function seedObservedFromBody(currentBody: string): string {
  const { markdown } = splitPageProps(currentBody);
  return extractChecklistItems(extractH2Section(markdown, "已观察到的功能")).join("\n");
}

export function seedAnomaliesFromBody(currentBody: string): string {
  const { markdown } = splitPageProps(currentBody);
  const raw = extractH2Section(markdown, "已观察到的异常");
  if (!raw) return "";
  return raw
    .split("\n")
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter((l) => l && !/暂无/.test(l))
    .join("\n");
}

function asStringArray(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.replace(/^[\-\*]\s*\[[ xX]?\]\s*/, "").trim();
    if (!t || t.length > 400) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function asDirections(raw: unknown): AiTestDirection[] {
  if (!Array.isArray(raw)) return [];
  const out: AiTestDirection[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) continue;
    out.push({
      title: title.slice(0, 120),
      derivedFrom: typeof o.derivedFrom === "string" ? o.derivedFrom.trim().slice(0, 200) : "",
      why: typeof o.why === "string" ? o.why.trim().slice(0, 300) : "",
      relatedModule: typeof o.relatedModule === "string" ? o.relatedModule.trim().slice(0, 120) : "",
      mayExpose: typeof o.mayExpose === "string" ? o.mayExpose.trim().slice(0, 300) : "",
    });
    if (out.length >= 12) break;
  }
  return out;
}

function asTasks(raw: unknown): AiTestTaskDetail[] {
  if (!Array.isArray(raw)) return [];
  const out: AiTestTaskDetail[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) continue;
    const steps = asStringArray(o.steps, 12);
    let issueType = typeof o.issueType === "string" ? o.issueType.trim() : "测试任务";
    if (/已确认\s*Bug/i.test(issueType)) issueType = "待验证风险";
    out.push({
      title: title.slice(0, 120),
      purpose: typeof o.purpose === "string" ? o.purpose.trim().slice(0, 300) : "",
      preconditions: typeof o.preconditions === "string" ? o.preconditions.trim().slice(0, 300) : "",
      steps,
      expected: typeof o.expected === "string" ? o.expected.trim().slice(0, 400) : "",
      mayExpose: typeof o.mayExpose === "string" ? o.mayExpose.trim().slice(0, 300) : "",
      issueType: issueType.slice(0, 40) || "测试任务",
    });
    if (out.length >= 14) break;
  }
  return out;
}

function asBugDirs(raw: unknown): AiBugDirection[] {
  if (!Array.isArray(raw)) return [];
  const out: AiBugDirection[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) continue;
    let category = typeof o.category === "string" ? o.category.trim() : "待验证风险";
    if (/已确认\s*Bug/i.test(category)) category = "待验证风险";
    out.push({
      title: title.slice(0, 160),
      note: typeof o.note === "string" ? o.note.trim().slice(0, 300) : "",
      category: category.slice(0, 40) || "待验证风险",
    });
    if (out.length >= 10) break;
  }
  return out;
}

export function normalizeAnalysis(raw: Partial<AiTestAnalysisJson>): InvestigationAiSections {
  return {
    goal: typeof raw.goal === "string" ? raw.goal.trim().slice(0, 500) : "",
    observed: asStringArray(raw.observed, 14),
    observedAnomalies: asStringArray(raw.observedAnomalies, 10),
    featureBreakdown: asStringArray(raw.featureBreakdown, 16),
    testDirections: asDirections(raw.testDirections),
    testTasks: asTasks(raw.testTasks),
    bugDirections: asBugDirs(raw.bugDirections),
    rulesToConfirm: asStringArray(raw.rulesToConfirm, 12),
    coverageGaps: asStringArray(raw.coverageGaps, 10),
    investigate: asStringArray(raw.investigate, 16),
  };
}

function resolveGoal(input: GenerateInvestigationInput): string {
  return (
    input.featureGoal?.trim() ||
    input.pageDescription.trim() ||
    seedDescriptionFromBody(input.currentBody, input.pageTitle)
  );
}

/** 无 Key 时的规则兜底 */
export function ruleBasedInvestigation(
  input: GenerateInvestigationInput
): InvestigationAiSections {
  const feature =
    input.pageTitle.replace(/[｜|].*$/, "").replace(/功能调查与测试任务/g, "").trim() ||
    "本功能";
  const module = input.moduleName?.trim() || "本模块";
  const goal =
    resolveGoal(input).slice(0, 280) ||
    `确认「${feature}」的入口、支持范围、状态反馈、异常处理和与其它模块的关系。`;
  const observed =
    splitLines(input.observedFeatures).length > 0
      ? splitLines(input.observedFeatures)
      : extractChecklistItems(
          extractH2Section(splitPageProps(input.currentBody).markdown, "已观察到的功能")
        );
  const anomalies = splitLines(input.observedAnomalies);
  const note = input.revisionNote?.trim() ?? "";

  const investigate = [
    `找到「${feature}」入口，记录支持方式与适用端`,
    "验证主路径与常见边界（多选、批量、权限、失败重试）",
    "记录限制（大小、数量、格式、路径、并发等）",
    "观察进度、状态反馈与任务中心/切页后表现",
    "确认异常提示（无权限、空间不足、网络断开等）",
    "核对页面显示状态与实际落地是否一致",
  ];
  if (note) investigate.unshift(`按修改说明核对：${note.slice(0, 80)}`);

  const testDirections: AiTestDirection[] = [
    {
      title: "正常主链路",
      derivedFrom: "用户核心目标",
      why: "确认核心价值路径可完成",
      relatedModule: `${module} / ${feature}`,
      mayExpose: "主路径失败、反馈缺失",
    },
    {
      title: "边界与限制",
      derivedFrom: "操作前后状态变化 / 页面或 PRD 规则",
      why: "限制与冲突策略常缺文档",
      relatedModule: feature,
      mayExpose: "超限无提示、同名冲突错误",
    },
    {
      title: "异常中断与网络恢复",
      derivedFrom: "异常、中断和恢复场景",
      why: "中断后状态与任务中心易不一致",
      relatedModule: `${module} / 任务中心`,
      mayExpose: "僵尸任务、提示混用",
    },
    {
      title: "权限、路径与数据完整性",
      derivedFrom: "前后模块联动 / 历史与当前数据一致性",
      why: "显示成功但未落地、关联断裂",
      relatedModule: module,
      mayExpose: "权限绕过、列表未刷新、历史失效",
    },
  ];

  const testTasks: AiTestTaskDetail[] = [
    {
      title: `「${feature}」正常主路径`,
      purpose: "验证完整用户链路可走通",
      preconditions: `已登录；具备「${feature}」基本权限`,
      steps: ["进入入口", "按主路径完成一次操作", "核对结果与列表/任务状态"],
      expected: "操作成功；状态与数据一致；提示准确",
      mayExpose: "主路径失败、状态不同步",
      issueType: "测试任务",
    },
    {
      title: "边界条件（数量/大小/格式/同名）",
      purpose: "验证限制与冲突策略",
      preconditions: "准备边界样例数据",
      steps: ["触发边界条件", "观察拦截或策略", "核对提示文案"],
      expected: "行为符合规则或标记待确认；提示不混用",
      mayExpose: "限制缺失、提示笼统",
      issueType: "测试任务",
    },
    {
      title: "异常中断 / 网络变化后恢复",
      purpose: "验证中断与恢复后状态真实",
      preconditions: "可模拟断网或取消",
      steps: ["操作进行中中断或断网", "恢复后查看任务/列表", "核对是否可重试"],
      expected: "状态真实；可恢复或明确失败；无僵尸任务",
      mayExpose: "显示与落地不一致",
      issueType: "待验证风险",
    },
    {
      title: "切页 / 跨模块后再看状态",
      purpose: "验证跨模块联动与状态持久",
      preconditions: "任务进行中",
      steps: ["切换页面或相关模块", "返回原入口", "核对任务与结果"],
      expected: "关联正确；列表完整可刷新",
      mayExpose: "任务丢失、关联断裂",
      issueType: "测试任务",
    },
  ];

  if (anomalies.length) {
    testTasks.unshift({
      title: "核对已观察异常是否可复现",
      purpose: "把现象升级为可复现证据，未复现不记 Bug",
      preconditions: "按已观察异常的环境与步骤准备",
      steps: ["按描述复现", "记录实际结果与截图", "对照预期与规则"],
      expected: "能判定为已确认 Bug / 待确认 / 非问题",
      mayExpose: anomalies[0] ?? "异常描述不完整",
      issueType: "待验证风险",
    });
  }

  return normalizeAnalysis({
    goal,
    observed: observed.length ? observed : ["（打开产品后勾选已实际看到的能力）"],
    observedAnomalies: anomalies,
    featureBreakdown: [
      `${feature}：入口与适用端`,
      "主路径与状态反馈",
      "边界、权限、异常与恢复",
      "与任务中心/其它模块联动",
    ],
    testDirections,
    testTasks,
    bugDirections: anomalies.map((a) => ({
      title: a.slice(0, 80),
      note: "仅观察，未复现前不入库为 Bug",
      category: "待验证风险",
    })),
    rulesToConfirm: [
      "同名冲突、超限、无权限时的正式预期是否有文档",
      "任务中心与切页后任务是否必须续跑",
      anomalies.length ? "已观察异常是否符合设计（非 Bug）" : "关键异常提示文案是否统一",
    ],
    coverageGaps: [
      "多端/系统差异",
      "历史数据迁移后一致性",
      "设置项修改后的持久化（若本功能涉及）",
    ],
    investigate,
  });
}

function buildUserPrompt(input: GenerateInvestigationInput): string {
  const { markdown } = splitPageProps(input.currentBody);
  const currentInv = extractChecklistItems(extractH2Section(markdown, "调查任务"));
  const currentTests = extractH2Section(markdown, "测试任务");
  const goal = resolveGoal(input);
  const observed =
    splitLines(input.observedFeatures).join("\n") ||
    extractChecklistItems(extractH2Section(markdown, "已观察到的功能")).join("\n");
  const anomalies =
    input.observedAnomalies?.trim() ||
    seedAnomaliesFromBody(input.currentBody) ||
    "（无）";

  return [
    `模式：${input.mode === "regenerate" ? "重新生成（参考旧清单，按修改说明调整；合并重复）" : "首次生成"}`,
    `页面标题：${input.pageTitle || "（无）"}`,
    "",
    "产品模块：",
    input.moduleName?.trim() || "（未填）",
    "",
    "功能目标：",
    goal.slice(0, 2000) || "（空）",
    "",
    "已观察到的功能：",
    observed.slice(0, 2000) || "（无）",
    "",
    "已观察到的异常：",
    anomalies.slice(0, 2000),
    "",
    input.revisionNote?.trim()
      ? `需要修改的说明：\n${input.revisionNote.trim().slice(0, 1200)}`
      : "需要修改的说明：（无）",
    currentInv.length ? `\n当前调查任务：\n${currentInv.map((t) => `- ${t}`).join("\n")}` : "",
    currentTests ? `\n当前测试任务原文（供合并去重）：\n${currentTests.slice(0, 2500)}` : "",
    "",
    "请输出 JSON，字段：",
    JSON.stringify(
      {
        goal: "string 功能目标",
        observed: ["已观察到的功能，保留用户已确认项并可补全建议观察项"],
        observedAnomalies: ["已观察异常摘要；无则 []"],
        featureBreakdown: ["A. 功能拆解要点"],
        testDirections: [
          {
            title: "",
            derivedFrom: "推导来源（见准则）",
            why: "为何要测",
            relatedModule: "",
            mayExpose: "",
          },
        ],
        investigate: ["短调查勾选项：去找/验证/记录"],
        testTasks: [
          {
            title: "",
            purpose: "",
            preconditions: "",
            steps: ["..."],
            expected: "",
            mayExpose: "",
            issueType: "测试任务|待验证风险|交互优化|兼容性问题|需求规则缺失（禁止未复现写已确认 Bug）",
          },
        ],
        bugDirections: [
          {
            title: "可能方向",
            note: "未复现说明",
            category: "待验证风险",
          },
        ],
        rulesToConfirm: ["E. 需研发确认的规则"],
        coverageGaps: ["当前测试范围缺口"],
      },
      null,
      2
    ),
    "",
    "对应输出：A 功能拆解→featureBreakdown；B 测试方向→testDirections；C 精简测试任务→testTasks；D Bug 方向→bugDirections；E 确认规则→rulesToConfirm；另给 coverageGaps 与 investigate。",
  ]
    .filter((x) => x !== null)
    .join("\n");
}

export async function generateInvestigationTasks(
  input: GenerateInvestigationInput,
  credentials: OpenAiCredentials | null
): Promise<GenerateInvestigationResult> {
  const goal = resolveGoal(input);
  if (!goal && input.mode === "generate") {
    throw new Error("请先填写「功能目标」或「页面/功能描述」。");
  }

  const ruled = ruleBasedInvestigation(input);

  if (!credentials?.apiKey?.trim()) {
    return {
      sections: ruled,
      method: "rule",
      body: mergeInvestigationSections(input.currentBody, ruled),
    };
  }

  const { apiKey, model, baseUrl } = resolveOpenAiCredentials(credentials);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PRODUCT_TEST_ANALYST_SYSTEM },
          { role: "user", content: buildUserPrompt(input) },
        ],
      }),
    });
    if (!response.ok) {
      return {
        sections: ruled,
        method: "rule",
        body: mergeInvestigationSections(input.currentBody, ruled),
      };
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return {
        sections: ruled,
        method: "rule",
        body: mergeInvestigationSections(input.currentBody, ruled),
      };
    }
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const parsed = JSON.parse(fenced ? fenced[1].trim() : content) as Partial<AiTestAnalysisJson>;
    const sections = normalizeAnalysis(parsed);
    if (!sections.goal || sections.testTasks.length === 0) {
      return {
        sections: ruled,
        method: "rule",
        body: mergeInvestigationSections(input.currentBody, ruled),
      };
    }
    if (!sections.observed.length) sections.observed = ruled.observed;
    if (!sections.investigate.length) sections.investigate = ruled.investigate;
    if (!sections.testDirections.length) sections.testDirections = ruled.testDirections;
    return {
      sections,
      method: "openai",
      body: mergeInvestigationSections(input.currentBody, sections),
    };
  } catch {
    return {
      sections: ruled,
      method: "rule",
      body: mergeInvestigationSections(input.currentBody, ruled),
    };
  }
}

export { AI_HEADINGS };
