/**
 * Star PM 内置「模块模板」Wiki：写进 proj-star-pm，站内可打开/改；套用时优先读库，缺省回落代码生成。
 */
import {
  buildFeatureInvestigationTemplate,
  buildFileUploadInvestigationTemplate,
  buildModuleHomeBioTemplate,
  defaultFeatureAreasForModule,
  FILE_MANAGER_FEATURE_AREAS,
} from "@/lib/modules/module-page-templates";
import {
  createWikiPage,
  listWikiPagesByHost,
  updateWikiPage,
  type WikiPagePatch,
} from "@/lib/wiki-pages/store";
import type { ProjectWikiPage } from "@/lib/types";

/** Studio id；写入 Wiki 时会 resolve 成真实 PM project.id */
export const BUILTIN_TEMPLATE_STUDIO_ID = "proj-star-pm";
export const BUILTIN_TEMPLATE_MODULE = "模块模板";
/** @deprecated 用 resolveBuiltinTemplatePmProjectId */
export const BUILTIN_TEMPLATE_PROJECT_ID = BUILTIN_TEMPLATE_STUDIO_ID;

export async function resolveBuiltinTemplatePmProjectId(): Promise<string> {
  const { resolvePmProject } = await import("@/lib/bugs/resolve-pm");
  const { pm } = await resolvePmProject(BUILTIN_TEMPLATE_STUDIO_ID);
  if (pm?.id) return pm.id;
  // 线上已知 PM UUID（Studio id 为 proj-star-pm）
  const KNOWN_PM = "a1000001-0001-4001-8001-000000000003";
  try {
    const { getProjects } = await import("@/lib/db/local-store");
    const all = await getProjects();
    const bySlug = all.find((p) => p.slug === "star-pm" || p.id === KNOWN_PM);
    if (bySlug) return bySlug.id;
  } catch {
    /* ignore */
  }
  return KNOWN_PM;
}

export const BUILTIN_TEMPLATE_TITLES = {
  index: "模板说明",
  moduleHome: "模块主页模板",
  investigation: "功能调查与测试模板",
  fileManagerHome: "示例·文件管理主页",
  fileUploadInvestigation: "示例·文件上传调查与测试",
} as const;

const PLACEHOLDER = "{{模块名}}";

export function listBuiltinTemplateSpecs(): Array<{
  title: string;
  body: string;
}> {
  const moduleHomeBody = buildModuleHomeBioTemplate({
    moduleName: PLACEHOLDER,
    goal: `管理「${PLACEHOLDER}」相关核心操作与体验（请按实际产品改写）。`,
    capability: "（核心能力关键词…）",
    featureAreas: [{ title: "功能分区 A", bullets: ["待拆解的能力点…"] }],
  });

  const investigationBody = buildFeatureInvestigationTemplate({
    featureTitle: "{{功能名}}",
    moduleName: PLACEHOLDER,
    goal: `确认「{{功能名}}」的入口、支持范围、状态反馈、异常处理。`,
  });

  const fileHome = buildModuleHomeBioTemplate({
    moduleName: "文件管理",
    goal: "管理文件浏览、上传下载、复制移动、删除、搜索与权限等核心操作。",
    capability: "文件列表、上传下载、复制移动、批量操作、搜索、权限、回收站",
    featureAreas: FILE_MANAGER_FEATURE_AREAS,
  });

  const indexBody = `# 模块 / 调查模板（内置）

对齐 Notion「文件管理」模块主页 +「功能调查与测试任务」。

## 怎么用

1. 打开任意项目的**模块主页** → 点 **套用模块模板**（会按当前模块名筛选关联表）。
2. 在「功能拆解与子页面」新建子页时勾选 **套用功能调查与测试模板**。
3. 调查页上可用 **AI 生成调查与测试任务**（产品测试分析助手）：填写产品模块、功能目标、已观察功能/异常；可 **重新生成** 并写「需要修改的说明」。输出含功能拆解、测试方向（含推导来源）、精简测试任务、Bug 方向、待确认规则；**未复现不写 Bug**。
4. 改本库下的模板正文后，下次套用会优先用这里的正文（\`{{模块名}}\` / \`{{功能名}}\` 会被替换）。

## 子页

- **模块主页模板**：简介 + 关联表顺序：需求 → PRD → Bug → 知识点 → 优化 → 竞品
- **功能调查与测试模板**：目标 / 观察 / 异常 / 拆解 / 方向 / 调查 / 测试 / Bug方向 / 待确认 / 缺口 / 记录 / 判断规则 + 边测边记表；支持 AI 生成
- **示例·文件管理**：按 Notion 文件管理填好的样例，可对照

不同模块套用时，表筛选与标题里的模块名会换成该模块；功能分区也可不同。
`;

  return [
    { title: BUILTIN_TEMPLATE_TITLES.index, body: indexBody },
    { title: BUILTIN_TEMPLATE_TITLES.moduleHome, body: moduleHomeBody },
    { title: BUILTIN_TEMPLATE_TITLES.investigation, body: investigationBody },
    { title: BUILTIN_TEMPLATE_TITLES.fileManagerHome, body: fileHome },
    {
      title: BUILTIN_TEMPLATE_TITLES.fileUploadInvestigation,
      body: buildFileUploadInvestigationTemplate("文件管理"),
    },
  ];
}

export async function findBuiltinTemplatePage(
  title: string
): Promise<ProjectWikiPage | null> {
  const projectId = await resolveBuiltinTemplatePmProjectId();
  const pages = await listWikiPagesByHost({
    projectId,
    hostKind: "module",
    hostKey: BUILTIN_TEMPLATE_MODULE,
    parentId: null,
  });
  return pages.find((p) => p.title.trim() === title.trim()) ?? null;
}

/** 把占位符换成实际模块/功能名 */
export function materializeBuiltinTemplateBody(
  body: string,
  input: { moduleName: string; featureTitle?: string }
): string {
  let out = body ?? "";
  const mod = input.moduleName.trim() || "未命名模块";
  const feat = input.featureTitle?.trim() || "未命名功能";
  out = out.split(PLACEHOLDER).join(mod);
  out = out.split("{{功能名}}").join(feat);
  return out;
}

/** 内置模板落后于代码结构时自动覆盖（用户手改过的同标题页也会被刷新；要保留请改标题另存） */
export function builtinTemplateBodyIsStale(title: string, body: string): boolean {
  const b = body ?? "";
  if (!b.trim()) return true;
  if (title === BUILTIN_TEMPLATE_TITLES.index) {
    return !b.includes("产品测试分析助手");
  }
  if (
    title === BUILTIN_TEMPLATE_TITLES.moduleHome ||
    title === BUILTIN_TEMPLATE_TITLES.fileManagerHome
  ) {
    const prd = b.indexOf("## 关联 PRD");
    const bug = b.indexOf("## 关联 Bug");
    return prd < 0 || bug < 0 || prd > bug || !b.includes("AI 生成");
  }
  if (
    title === BUILTIN_TEMPLATE_TITLES.investigation ||
    title === BUILTIN_TEMPLATE_TITLES.fileUploadInvestigation
  ) {
    return !b.includes("## 测试范围缺口") || !b.includes("## 已观察到的异常");
  }
  return false;
}

/**
 * 幂等写入 Star PM「模块模板」下的内置 Wiki。
 * 默认：空正文或结构过期（缺新章节/关联顺序旧）时覆盖；overwrite=true 强制全量覆盖。
 */
export async function ensureBuiltinModuleTemplatesInPm(options?: {
  /** true=已存在也覆盖正文 */
  overwrite?: boolean;
}): Promise<{
  created: string[];
  updated: string[];
  skipped: string[];
  projectId: string;
}> {
  const overwrite = Boolean(options?.overwrite);
  const projectId = await resolveBuiltinTemplatePmProjectId();
  const existing = await listWikiPagesByHost({
    projectId,
    hostKind: "module",
    hostKey: BUILTIN_TEMPLATE_MODULE,
    parentId: null,
  });
  const byTitle = new Map(existing.map((p) => [p.title.trim(), p]));
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const spec of listBuiltinTemplateSpecs()) {
    const hit = byTitle.get(spec.title);
    if (!hit) {
      const page = await createWikiPage({
        project_id: projectId,
        title: spec.title,
        body: spec.body,
        host_kind: "module",
        host_key: BUILTIN_TEMPLATE_MODULE,
        parent_id: null,
      });
      created.push(page.id);
      continue;
    }
    const stale = builtinTemplateBodyIsStale(spec.title, hit.body ?? "");
    if (overwrite || stale) {
      const patch: WikiPagePatch = { body: spec.body };
      await updateWikiPage(hit.id, patch);
      updated.push(hit.id);
    } else {
      skipped.push(hit.id);
    }
  }

  return { created, updated, skipped, projectId };
}

/** 读内置模板正文；没有则 null（调用方回落代码生成） */
export async function loadBuiltinTemplateBody(
  kind: "moduleHome" | "investigation" | "fileUploadInvestigation"
): Promise<string | null> {
  const title =
    kind === "moduleHome"
      ? BUILTIN_TEMPLATE_TITLES.moduleHome
      : kind === "investigation"
        ? BUILTIN_TEMPLATE_TITLES.investigation
        : BUILTIN_TEMPLATE_TITLES.fileUploadInvestigation;
  const page = await findBuiltinTemplatePage(title);
  const body = page?.body?.trim() ?? "";
  return body || null;
}

export function resolveModuleHomeBodyFromBuiltinOrCode(input: {
  builtinBody: string | null;
  moduleName: string;
  goal?: string;
  capability?: string;
}): string {
  if (input.builtinBody?.trim()) {
    return materializeBuiltinTemplateBody(input.builtinBody, {
      moduleName: input.moduleName,
    });
  }
  const areas = defaultFeatureAreasForModule(input.moduleName);
  return buildModuleHomeBioTemplate({
    moduleName: input.moduleName,
    goal: input.goal,
    capability: input.capability,
    featureAreas: areas.length ? areas : undefined,
  });
}
