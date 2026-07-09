import { NotionClient, type NotionPage } from "@/lib/notion/client";
import {
  getNotionImportConfig,
  notionPageUrl,
  studioIdFromNotion,
  type NotionImportConfig,
} from "@/lib/notion/config";
import {
  blocksToPlainText,
  getPageTitle,
  getPropertyRelationIds,
  getPropertyText,
  matchSelect,
  parseProjectBodyFromBlocks,
} from "@/lib/notion/parse";
import type { StudioSnapshot } from "@/lib/studio/store";
import type {
  Asset,
  AssetType,
  EmotionLevel,
  EvolutionLog,
  EvolutionLogType,
  Idea,
  IdeaStatus,
  IdeaType,
  Project,
  ProjectBody,
  ProjectPriority,
  ProjectStatus,
  StudioTask,
  TaskPriority,
  TaskStatus,
} from "@/lib/studio/types";

const EMPTY_BODY: ProjectBody = {
  initialThought: "",
  whyThought: "",
  positioning: "",
  iterations: "",
  done: "",
  notDone: "",
  nextStep: "",
  links: "",
  retrospectives: "",
};

const STATUS_MAP: Record<string, ProjectStatus> = {
  主线: "mainline",
  mainline: "mainline",
  进行中: "active",
  active: "active",
  展示: "demo",
  demo: "demo",
  停车: "parking",
  parking: "parking",
  归档: "archived",
  archived: "archived",
};

const PRIORITY_MAP: Record<string, ProjectPriority> = {
  P0: "P0",
  P1: "P1",
  P2: "P2",
  P3: "P3",
};

const IDEA_STATUS_MAP: Record<string, IdeaStatus> = {
  收件箱: "inbox",
  inbox: "inbox",
  审阅中: "reviewing",
  reviewing: "reviewing",
  已转项目: "converted",
  converted: "converted",
  停车: "parked",
  parked: "parked",
  归档: "archived",
  archived: "archived",
};

const IDEA_TYPE_MAP: Record<string, IdeaType> = {
  产品: "product",
  product: "product",
  功能: "feature",
  feature: "feature",
  UI: "ui",
  ui: "ui",
  内容: "content",
  content: "content",
  技术: "tech",
  tech: "tech",
  商业: "business",
  business: "business",
};

const EMOTION_MAP: Record<string, EmotionLevel> = {
  一般: "normal",
  normal: "normal",
  喜欢: "like",
  like: "like",
  啊啊啊: "excited",
  excited: "excited",
  好想做: "excited",
};

const EVOLUTION_TYPE_MAP: Record<string, EvolutionLogType> = {
  初始想法: "initial",
  initial: "initial",
  定位变化: "positioning",
  positioning: "positioning",
  功能新增: "feature_add",
  砍掉功能: "feature_cut",
  技术决策: "tech_decision",
  UI调整: "ui_change",
  阶段复盘: "stage_review",
};

const TASK_STATUS_MAP: Record<string, TaskStatus> = {
  待做: "todo",
  todo: "todo",
  进行中: "in_progress",
  已完成: "done",
  done: "done",
  暂停: "paused",
  paused: "paused",
};

const ASSET_TYPE_MAP: Record<string, AssetType> = {
  竞品: "competitor",
  competitor: "competitor",
  UI参考: "ui_ref",
  ui_ref: "ui_ref",
  技术文档: "tech_doc",
  tech_doc: "tech_doc",
  视频: "video",
  video: "video",
  素材: "material",
  material: "material",
  灵感: "inspiration",
  inspiration: "inspiration",
};

export interface NotionImportResult {
  snapshot: StudioSnapshot;
  stats: {
    projects: number;
    ideas: number;
    evolutionLogs: number;
    tasks: number;
    assets: number;
  };
  warnings: string[];
}

function projectIdFromNotion(notionPageId: string) {
  return studioIdFromNotion("proj-notion-", notionPageId);
}

function ideaIdFromNotion(notionPageId: string) {
  return studioIdFromNotion("idea-notion-", notionPageId);
}

function evolutionIdFromNotion(notionPageId: string) {
  return studioIdFromNotion("evo-notion-", notionPageId);
}

function taskIdFromNotion(notionPageId: string) {
  return studioIdFromNotion("task-notion-", notionPageId);
}

function assetIdFromNotion(notionPageId: string) {
  return studioIdFromNotion("asset-notion-", notionPageId);
}

async function mapNotionPageToProject(
  client: NotionClient,
  pageId: string,
  warnings: string[]
): Promise<Project> {
  const page = await client.getPage(pageId);
  const blocks = await client.listBlockChildren(pageId);
  const bodySections = parseProjectBodyFromBlocks(blocks);
  const fallbackText = blocksToPlainText(blocks);

  const title =
    getPropertyText(page, "项目名称", "名称", "标题", "Name", "Title") || getPageTitle(page);

  const statusRaw = getPropertyText(page, "状态", "Status");
  const priorityRaw = getPropertyText(page, "优先级", "Priority");

  const positioning =
    getPropertyText(page, "项目定位", "定位", "Positioning") ||
    bodySections.positioning ||
    "";

  const body: ProjectBody = {
    ...EMPTY_BODY,
    ...bodySections,
    positioning: bodySections.positioning || positioning,
    initialThought: bodySections.initialThought || fallbackText.slice(0, 2000),
  };

  const now = page.last_edited_time || new Date().toISOString();

  if (!bodySections.initialThought && !getPropertyText(page, "项目定位", "定位")) {
    warnings.push(`项目「${title}」未识别到正文分区，已用页面全文作为初始想法`);
  }

  return {
    id: projectIdFromNotion(page.id),
    title,
    positioning,
    targetUser: getPropertyText(page, "目标用户", "用户", "Target User"),
    status: matchSelect(statusRaw, STATUS_MAP, "active"),
    priority: matchSelect(priorityRaw, PRIORITY_MAP, "P2"),
    currentStage: getPropertyText(page, "当前阶段", "阶段", "Stage"),
    nextAction:
      getPropertyText(page, "下一步", "当前下一步", "Next Action") || body.nextStep,
    demoUrl: getPropertyText(page, "展示链接", "Demo", "demoUrl") || null,
    localRunGuide: getPropertyText(page, "本地启动", "启动命令") || null,
    codePath: getPropertyText(page, "代码目录", "代码路径") || null,
    githubRepo: getPropertyText(page, "GitHub", "仓库", "github") || null,
    vercelUrl: getPropertyText(page, "Vercel", "部署链接") || null,
    lastCommitMessage: null,
    lastCommitAt: null,
    relatedPageUrl: page.url ?? notionPageUrl(page.id),
    portfolioValue: getPropertyText(page, "作品集价值", "作品集"),
    body,
    createdAt: page.created_time || now,
    updatedAt: now,
  };
}

function inferEntityKind(page: NotionPage): "idea" | "evolution" | "task" | "asset" | "project" | "unknown" {
  const keys = Object.keys(page.properties).join(" ");
  const title = getPageTitle(page);

  if (keys.match(/演进|变化前|变化后|logType|Log Type/i) || title.includes("演进")) {
    return "evolution";
  }
  if (keys.match(/任务|Task|阻塞|blocker/i)) return "task";
  if (keys.match(/资料|链接|Asset|URL|竞品/i)) return "asset";
  if (keys.match(/一句话|情绪|触发|灵感|Idea/i)) return "idea";
  if (keys.match(/项目定位|阶段|主线|Portfolio/i)) return "project";
  return "unknown";
}

function mapIdeaPage(page: NotionPage, projectIdByNotion: Map<string, string>): Idea {
  const relationIds = getPropertyRelationIds(page, "关联项目", "项目", "Project");
  const relatedNotionId = relationIds[0];
  const relatedProjectId = relatedNotionId
    ? (projectIdByNotion.get(relatedNotionId) ?? projectIdFromNotion(relatedNotionId))
    : null;

  return {
    id: ideaIdFromNotion(page.id),
    title: getPropertyText(page, "标题", "名称", "Name") || getPageTitle(page),
    oneLineIdea: getPropertyText(page, "一句话想法", "想法", "One-line", "Idea"),
    whyItMatters: getPropertyText(page, "为什么", "为什么想到", "Why"),
    triggerSource: getPropertyText(page, "触发来源", "来源", "Trigger"),
    emotionLevel: matchSelect(
      getPropertyText(page, "情绪", "Emotion"),
      EMOTION_MAP,
      "normal"
    ),
    type: matchSelect(getPropertyText(page, "类型", "Type"), IDEA_TYPE_MAP, "product"),
    priority: matchSelect(getPropertyText(page, "优先级", "Priority"), PRIORITY_MAP, "P2"),
    rawInput: "",
    relatedProjectId,
    relatedIdeaId: null,
    subtasks: [],
    status: matchSelect(getPropertyText(page, "状态", "Status"), IDEA_STATUS_MAP, "inbox"),
    suggestedNextStep: getPropertyText(page, "下一步", "下一步建议"),
    githubIssueNumber: null,
    githubIssueUrl: null,
    githubLabels: [],
    createdAt: page.created_time || new Date().toISOString(),
    updatedAt: page.last_edited_time || page.created_time || new Date().toISOString(),
  };
}

function mapEvolutionPage(page: NotionPage, projectIdByNotion: Map<string, string>): EvolutionLog | null {
  const relationIds = getPropertyRelationIds(page, "项目", "关联项目", "Project");
  const projectNotionId = relationIds[0];
  if (!projectNotionId) return null;

  const projectId =
    projectIdByNotion.get(projectNotionId) ?? projectIdFromNotion(projectNotionId);

  return {
    id: evolutionIdFromNotion(page.id),
    title: getPropertyText(page, "标题", "名称") || getPageTitle(page),
    projectId,
    logType: matchSelect(
      getPropertyText(page, "类型", "记录类型", "Log Type"),
      EVOLUTION_TYPE_MAP,
      "stage_review"
    ),
    before: getPropertyText(page, "变化前", "Before"),
    after: getPropertyText(page, "变化后", "After"),
    reason: getPropertyText(page, "为什么", "原因", "Reason"),
    decision: getPropertyText(page, "结论", "决策", "Decision"),
    createdAt: page.created_time || new Date().toISOString(),
  };
}

function mapTaskPage(page: NotionPage, projectIdByNotion: Map<string, string>): StudioTask | null {
  const relationIds = getPropertyRelationIds(page, "项目", "关联项目", "Project");
  const projectNotionId = relationIds[0];
  if (!projectNotionId) return null;

  const projectId =
    projectIdByNotion.get(projectNotionId) ?? projectIdFromNotion(projectNotionId);

  return {
    id: taskIdFromNotion(page.id),
    title: getPropertyText(page, "标题", "任务", "Name") || getPageTitle(page),
    projectId,
    status: matchSelect(getPropertyText(page, "状态", "Status"), TASK_STATUS_MAP, "todo"),
    priority: matchSelect(getPropertyText(page, "优先级", "Priority"), PRIORITY_MAP, "P2"),
    workload: getPropertyText(page, "工作量", "Workload"),
    blocker: getPropertyText(page, "阻塞", "Blocker") || null,
    dueDate: getPropertyText(page, "截止日期", "Due") || null,
  };
}

function mapAssetPage(page: NotionPage, projectIdByNotion: Map<string, string>): Asset | null {
  const relationIds = getPropertyRelationIds(page, "项目", "关联项目", "Project");
  const projectNotionId = relationIds[0];
  if (!projectNotionId) return null;

  const projectId =
    projectIdByNotion.get(projectNotionId) ?? projectIdFromNotion(projectNotionId);

  return {
    id: assetIdFromNotion(page.id),
    title: getPropertyText(page, "标题", "名称") || getPageTitle(page),
    projectId,
    assetType: matchSelect(
      getPropertyText(page, "类型", "资料类型", "Asset Type"),
      ASSET_TYPE_MAP,
      "inspiration"
    ),
    url: getPropertyText(page, "链接", "URL", "Url"),
    note: getPropertyText(page, "备注", "Note"),
    takeaway: getPropertyText(page, "可借鉴", "Takeaway"),
    risk: getPropertyText(page, "风险", "Risk") || null,
  };
}

function mapDatabasePages(
  pages: NotionPage[],
  projectIdByNotion: Map<string, string>,
  warnings: string[]
): Pick<StudioSnapshot, "ideas" | "evolutionLogs" | "tasks" | "assets" | "projects"> {
  const ideas: Idea[] = [];
  const evolutionLogs: EvolutionLog[] = [];
  const tasks: StudioTask[] = [];
  const assets: Asset[] = [];
  const projects: Project[] = [];

  for (const page of pages) {
    const kind = inferEntityKind(page);

    if (kind === "idea") {
      ideas.push(mapIdeaPage(page, projectIdByNotion));
      continue;
    }
    if (kind === "evolution") {
      const log = mapEvolutionPage(page, projectIdByNotion);
      if (log) evolutionLogs.push(log);
      else warnings.push(`演进「${getPageTitle(page)}」缺少关联项目，已跳过`);
      continue;
    }
    if (kind === "task") {
      const task = mapTaskPage(page, projectIdByNotion);
      if (task) tasks.push(task);
      else warnings.push(`任务「${getPageTitle(page)}」缺少关联项目，已跳过`);
      continue;
    }
    if (kind === "asset") {
      const asset = mapAssetPage(page, projectIdByNotion);
      if (asset) assets.push(asset);
      else warnings.push(`资料「${getPageTitle(page)}」缺少关联项目，已跳过`);
      continue;
    }
    if (kind === "project") {
      const now = page.last_edited_time || new Date().toISOString();
      projects.push({
        id: projectIdFromNotion(page.id),
        title: getPropertyText(page, "项目名称", "名称") || getPageTitle(page),
        positioning: getPropertyText(page, "项目定位", "定位"),
        targetUser: getPropertyText(page, "目标用户", "用户"),
        status: matchSelect(getPropertyText(page, "状态", "Status"), STATUS_MAP, "active"),
        priority: matchSelect(getPropertyText(page, "优先级", "Priority"), PRIORITY_MAP, "P2"),
        currentStage: getPropertyText(page, "当前阶段", "阶段"),
        nextAction: getPropertyText(page, "下一步", "当前下一步"),
        demoUrl: getPropertyText(page, "展示链接", "Demo") || null,
        localRunGuide: getPropertyText(page, "本地启动") || null,
        codePath: getPropertyText(page, "代码目录") || null,
        githubRepo: getPropertyText(page, "GitHub", "仓库", "github") || null,
        vercelUrl: getPropertyText(page, "Vercel", "部署链接") || null,
        lastCommitMessage: null,
        lastCommitAt: null,
        relatedPageUrl: page.url ?? notionPageUrl(page.id),
        portfolioValue: getPropertyText(page, "作品集价值", "作品集"),
        body: {
          ...EMPTY_BODY,
          initialThought: getPropertyText(page, "初始想法", "想法"),
          whyThought: getPropertyText(page, "为什么", "为什么想到"),
          positioning: getPropertyText(page, "项目定位", "定位"),
        },
        createdAt: page.created_time || now,
        updatedAt: now,
      });
      continue;
    }

    // 默认当作灵感
    ideas.push(mapIdeaPage(page, projectIdByNotion));
  }

  return { ideas, evolutionLogs, tasks, assets, projects };
}

export async function fetchNotionStudioSnapshot(
  config: NotionImportConfig = getNotionImportConfig()!
): Promise<NotionImportResult> {
  if (!config?.token) throw new Error("NOTION_TOKEN 未配置");

  const client = new NotionClient(config.token);
  const warnings: string[] = [];
  const projectIdByNotion = new Map<string, string>();

  const projects: Project[] = [];

  for (const pageId of config.projectPageIds) {
    try {
      const project = await mapNotionPageToProject(client, pageId, warnings);
      projects.push(project);
      projectIdByNotion.set(pageId, project.id);
      projectIdByNotion.set(project.id.replace("proj-notion-", ""), project.id);
    } catch (error) {
      warnings.push(
        `项目页 ${pageId} 拉取失败：${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  let ideas: Idea[] = [];
  let evolutionLogs: EvolutionLog[] = [];
  let tasks: StudioTask[] = [];
  let assets: Asset[] = [];

  const databases: Array<{ id: string; label: string }> = [];
  if (config.ideaDatabaseId) databases.push({ id: config.ideaDatabaseId, label: "灵感库" });
  if (config.evolutionDatabaseId) {
    databases.push({ id: config.evolutionDatabaseId, label: "演进库" });
  }

  for (const db of databases) {
    try {
      const pages = await client.queryDatabase(db.id);
      const mapped = mapDatabasePages(pages, projectIdByNotion, warnings);

      for (const p of mapped.projects) {
        if (!projects.some((x) => x.id === p.id)) projects.push(p);
        projectIdByNotion.set(p.id.replace("proj-notion-", ""), p.id);
      }

      ideas = [...ideas, ...mapped.ideas];
      evolutionLogs = [...evolutionLogs, ...mapped.evolutionLogs];
      tasks = [...tasks, ...mapped.tasks];
      assets = [...assets, ...mapped.assets];
    } catch (error) {
      warnings.push(
        `${db.label} ${db.id} 拉取失败：${error instanceof Error ? error.message : "未知错误"}`
      );
    }
  }

  const snapshot: StudioSnapshot = {
    projects,
    ideas,
    evolutionLogs,
    tasks,
    assets,
  };

  return {
    snapshot,
    stats: {
      projects: projects.length,
      ideas: ideas.length,
      evolutionLogs: evolutionLogs.length,
      tasks: tasks.length,
      assets: assets.length,
    },
    warnings,
  };
}
