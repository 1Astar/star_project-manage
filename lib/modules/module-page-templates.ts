/**
 * 模块主页 / 功能调查·测试 页模板（对齐 Notion「文件管理」与「功能调查与测试任务」）。
 * 不同模块套用时只换模块名与功能分区；关联视图按 module 筛选，表格内可新建 Bug/优化/知识等。
 */
import {
  serializeLinkedViewFence,
  type LinkedViewSourceId,
} from "@/lib/linked-views/config";
import { defaultLinkedViewConfig } from "@/lib/linked-views/segments";
import { joinPageProps } from "@/lib/wiki-pages/page-props";

export type ModuleFeatureArea = {
  /** 子页标题，如「文件上传」 */
  title: string;
  /** 功能点清单（可选） */
  bullets?: string[];
};

/** 文件管理示例分区（来自 Notion 模块主页） */
export const FILE_MANAGER_FEATURE_AREAS: ModuleFeatureArea[] = [
  {
    title: "文件上传",
    bullets: [
      "上传单个文件",
      "上传文件夹",
      "批量上传",
      "拖拽上传",
      "上传进度与剩余时间",
      "暂停、取消、重试",
      "同名文件冲突处理",
      "上传失败与断点续传",
      "上传任务是否进入任务中心",
    ],
  },
  {
    title: "文件下载",
    bullets: [
      "单文件下载",
      "多文件/文件夹下载",
      "下载位置选择",
      "下载进度、暂停、取消、重试",
      "下载完成后的反馈与文件定位",
      "下载失败与重复下载处理",
    ],
  },
  {
    title: "文件组织与操作",
    bullets: [
      "新建文件夹",
      "复制、移动、重命名",
      "单选、多选、全选与批量操作",
      "删除、回收站、恢复与永久删除",
      "同名冲突、跨目录操作和权限不足处理",
    ],
  },
  {
    title: "搜索与浏览",
    bullets: [
      "目录浏览、排序、筛选",
      "文件名搜索、搜索范围和结果定位",
      "大目录加载、分页/虚拟列表",
      "文件类型、大小、修改时间等信息展示",
    ],
  },
  {
    title: "权限与共享",
    bullets: [
      "用户/群组权限",
      "无权限时的提示与申请路径",
      "分享链接、有效期、访问密码（如产品支持）",
      "SMB 等协议共享与本地挂载",
    ],
  },
];

/** 顺序对齐 Notion 模块主页：需求 → PRD → Bug → 知识点，再优化/竞品 */
const LIBRARY_SECTIONS: Array<{
  source: LinkedViewSourceId;
  heading: string;
  blurb: string;
  shortTitle: string;
}> = [
  {
    source: "requirement",
    heading: "相关需求",
    blurb: "本模块相关需求；表格内新建写入总库（替代静态 [[链接]] 列表）。",
    shortTitle: "需求",
  },
  {
    source: "prd",
    heading: "关联 PRD",
    blurb: "正式规则与版本以 PRD 库为准；此处按模块筛选聚合。",
    shortTitle: "PRD",
  },
  {
    source: "bug",
    heading: "关联 Bug",
    blurb: "本模块已记录问题；表格「新建」写入 Bug 总库。",
    shortTitle: "Bug",
  },
  {
    source: "learning",
    heading: "相关知识点",
    blurb: "技术与产品知识；验证后再作为规则依据。",
    shortTitle: "知识点",
  },
  {
    source: "optimization",
    heading: "相关优化建议",
    blurb: "体验改进机会；关联问题证据与知识点。",
    shortTitle: "优化",
  },
  {
    source: "competitor",
    heading: "竞品与调研参考",
    blurb: "竞品观察、聊天结论、截图和来源。",
    shortTitle: "竞品",
  },
];

function viewFence(source: LinkedViewSourceId, shortTitle: string, moduleName: string): string {
  return serializeLinkedViewFence(
    defaultLinkedViewConfig({ source, title: shortTitle, moduleName })
  );
}

/**
 * 模块主页简介模板：说明 + 工作流 + 功能分区提纲 + 六类关联表（按模块筛选）。
 */
export function buildModuleHomeBioTemplate(input: {
  moduleName: string;
  /** 一句话模块目标；空则用占位 */
  goal?: string;
  /** 核心能力摘要 */
  capability?: string;
  /** 功能分区（写在简介提纲里；真正子页另建） */
  featureAreas?: ModuleFeatureArea[];
}): string {
  const name = input.moduleName.trim() || "未命名模块";
  const goal =
    input.goal?.trim() ||
    `管理「${name}」相关核心操作与体验（请按实际产品改写本句）。`;
  const capability =
    input.capability?.trim() ||
    "（在此填写核心能力关键词，如：列表、上传下载、搜索、权限…）";
  const areas = input.featureAreas?.length
    ? input.featureAreas
    : [{ title: "功能分区 A", bullets: ["待拆解的能力点…"] }];

  const areaBlocks = areas
    .map((a) => {
      const bullets = (a.bullets ?? []).map((b) => `- ${b}`).join("\n");
      return `### ${a.title}\n\n${bullets || "- （待补充功能点）"}`;
    })
    .join("\n\n");

  const libraryBlocks = LIBRARY_SECTIONS.map((s) => {
    return `## ${s.heading}\n\n${s.blurb}\n\n${viewFence(s.source, s.shortTitle, name)}`;
  }).join("\n\n");

  return `# ${name}

${goal}

**核心能力：** ${capability}

这个页面是**模块主页**（如 NAS / ${name}）：相关需求、PRD、Bug、知识点等只在总库维护，下方用**关联表**按模块筛选（可新建）。详细调查与测试在功能子页用 AI 生成。

## 模块工作流

发现问题 → 记录证据 → 判断是 Bug 还是需求缺口 → 关联知识与竞品 → 形成优化建议 → 写入 PRD → 测试验证。

---

## 页面内容与功能

先把模块拆成可验证的功能分区（详细调查/测试放在「功能拆解与子页面」里）。

${areaBlocks}

## 功能拆解与调查

先把模块拆成可验证的功能点，再逐项记录已观察事实、待调查问题、测试场景和结论。**不要一开始就把未知行为判成 Bug。**

在下方「功能拆解与子页面」中，为每个分区建子页，并套用「功能调查与测试」模板；子页可用 **AI 生成调查与测试任务**（功能目标 + 已观察功能/异常 + 可重生成）。

${libraryBlocks}
`;
}

/**
 * 功能调查与测试任务页正文（对齐 Notion「文件上传｜功能调查与测试任务」）。
 * 页尾附带本模块 Bug / 优化 / 知识 三张筛选表，方便边测边记。
 */
export function buildFeatureInvestigationTemplate(input: {
  featureTitle: string;
  moduleName: string;
  /** 预填「已观察」勾选项 */
  observed?: string[];
  /** 预填调查任务 */
  investigate?: string[];
  /** 预填测试任务 */
  tests?: string[];
  goal?: string;
}): string {
  const feature = input.featureTitle.trim() || "未命名功能";
  const moduleName = input.moduleName.trim() || "";
  const goal =
    input.goal?.trim() ||
    `确认「${feature}」的入口、支持范围、状态反馈、异常处理和与其它模块的关系。`;

  const toChecks = (items: string[] | undefined, fallback: string[]) =>
    (items?.length ? items : fallback).map((t) => `- [ ] ${t}`).join("\n");

  const observed = toChecks(input.observed, ["（记下已实际看到的能力）"]);
  const investigate = toChecks(input.investigate, [
    "找到入口，记录支持方式与适用端",
    "验证主路径与边界（多选/批量/权限/失败）",
    "记录限制（大小、数量、格式、路径等）",
    "观察进度、并发与任务中心表现",
    "确认异常提示（无权限、空间不足、网络断开）",
  ]);
  const tests = toChecks(input.tests, [
    "主路径正常完成",
    "边界与异常各至少一条",
    "过程中切页后再看任务/状态",
  ]);

  const md = `## 功能目标

${goal}

## 已观察到的功能

${observed}

## 已观察到的异常

- （暂无；有截图/操作过程/实际结果时补上）

## 功能拆解

- （可用 AI 按功能目标与观察生成）

## 测试方向

- （可用 AI 生成；每条含推导来源与为何要测）

## 调查任务

${investigate}

## 测试任务

${tests}

## 可能的 Bug 方向

未复现前不记为 Bug。下列仅为待验证风险，需复现后再入库。

- （暂无）

## 待研发确认规则

- （暂无）

## 测试范围缺口

- （暂无）

## 测试记录

- 测试环境/版本：
- 前置条件：
- 操作步骤：
- 实际结果：
- 预期结果及依据：
- 截图/录屏：
- 结论：通过 / Bug / 需求缺口 / 优化建议 / 待确认
- 关联调研条目：

## 判断规则

没有观察到某能力不代表产品一定不支持；先查入口、权限、平台差异和文档。没有明确预期时标记**待确认**，不直接判 Bug。猜测不写 Bug。

## 边测边记（本模块筛选表）

在表中新建即可写入总库；筛选已带当前模块名。

### Bug

${viewFence("bug", "Bug", moduleName)}

### 优化建议

${viewFence("optimization", "优化", moduleName)}

### 知识点

${viewFence("learning", "知识点", moduleName)}
`;

  return joinPageProps(
    { status: "调研中", capability: feature },
    md
  );
}

/** 文件上传示例：用 Notion 页上的勾选清单做预填 */
export function buildFileUploadInvestigationTemplate(moduleName = "文件管理"): string {
  return buildFeatureInvestigationTemplate({
    featureTitle: "文件上传",
    moduleName,
    goal: "确认文件上传的入口、支持范围、状态反馈、异常处理和与任务中心的关系。",
    observed: ["上传单个文件", "上传文件夹"],
    investigate: [
      "找到上传入口，记录支持的文件选择方式与适用端",
      "验证是否支持多选、批量上传、拖拽上传",
      "记录文件大小、数量、格式、路径等限制",
      "观察进度、速度、剩余时间及并发上传表现",
      "验证暂停、取消、失败重试、断点续传",
      "验证同名文件冲突策略",
      "验证空间不足、无权限、网络断开时的提示",
      "确认上传任务是否进入任务中心，切页后是否继续",
    ],
    tests: [
      "单个小文件正常上传",
      "多文件批量上传",
      "上传大文件并观察进度变化",
      "上传中取消任务",
      "上传中断网后恢复",
      "同名文件上传",
      "目标目录无权限或空间不足",
      "上传期间切换页面，再检查任务状态",
    ],
  });
}

export function defaultFeatureAreasForModule(moduleName: string): ModuleFeatureArea[] {
  if (moduleName.trim() === "文件管理") return FILE_MANAGER_FEATURE_AREAS;
  return [];
}
