import type { StudioCustomFieldValue } from "@/lib/studio/types";

/** Studio customFields：项目 Hub 正文（Markdown） */
export const PROJECT_HUB_FIELD = "projectHubMd";

export function parseProjectHubMd(
  customFields: Record<string, StudioCustomFieldValue> | null | undefined
): string {
  const raw = customFields?.[PROJECT_HUB_FIELD];
  return typeof raw === "string" ? raw : "";
}

/** 空 Hub 时的默认骨架（对齐 Notion NAS 首页结构） */
export function defaultProjectHubMd(input: {
  title: string;
  positioning?: string | null;
  targetUser?: string | null;
  currentStage?: string | null;
  nextAction?: string | null;
}): string {
  const positioning =
    (input.positioning ?? "").trim() ||
    "（在此写清：本项目做什么、不做什么、当前阶段关注什么。）";
  const stage = (input.currentStage ?? "").trim();
  const next = (input.nextAction ?? "").trim();
  const user = (input.targetUser ?? "").trim();

  return `## 项目定位

${positioning}
${user ? `\n目标用户：${user}` : ""}
${stage ? `\n当前阶段：${stage}` : ""}

## 使用原则

- 以**产品模块**为导航入口，一层层点进功能拆解页
- 条目只在总库维护一次，模块主页用关联视图聚合
- 事实、判断与建议分开写；未知行为先调查，不要直接判成 Bug

## 工作入口

- 调研总览：看跨类型条目与关联
- 学习池 / 竞品 / 访谈：沉淀证据与结论
- 需求与任务 / PRD / Bug：正式跟进

## 当前工作方式

${next || "（写下当前正在推进的主线，以及下一步。）"}

## 数据入口

- 总览表、工作簿导入、Excel 导入
- 模块主页与子页面（功能拆解）

## 如何使用

1. 从本页「模块导航」点进模块主页
2. 在模块下建功能拆解子页，记录观察与待调查问题
3. 需求 / Bug / 知识在总库录入，挂上模块路径后自动聚合回来

## 归档

（阶段性结论、过期方案、已弃用入口可记在这里。）
`;
}

export function resolveProjectHubMd(input: {
  customFields?: Record<string, StudioCustomFieldValue> | null;
  title: string;
  positioning?: string | null;
  targetUser?: string | null;
  currentStage?: string | null;
  nextAction?: string | null;
}): { md: string; isDefault: boolean } {
  const saved = parseProjectHubMd(input.customFields).trim();
  if (saved) return { md: saved, isDefault: false };
  return {
    md: defaultProjectHubMd(input),
    isDefault: true,
  };
}
