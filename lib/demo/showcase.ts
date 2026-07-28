import type { Asset, EvolutionLog, Idea, Project, StudioTask } from "@/lib/studio/types";
import type { AuthRole } from "@/lib/auth/session-edge";
import type { StudioSnapshot } from "@/lib/studio/store";

/** Studio / 路由用稳定 ID */
export const DEMO_SHOWCASE_STUDIO_ID = "proj-demo-showcase";
/** PM 看板 slug */
export const DEMO_SHOWCASE_PM_SLUG = "demo-showcase";

const T0 = "2026-06-01T02:00:00.000Z";
const T1 = "2026-06-15T08:00:00.000Z";
const T2 = "2026-07-01T04:00:00.000Z";
const T3 = "2026-07-20T09:00:00.000Z";

export function isDemoShowcaseId(idOrSlug: string | null | undefined): boolean {
  if (!idOrSlug) return false;
  return (
    idOrSlug === DEMO_SHOWCASE_STUDIO_ID ||
    idOrSlug === DEMO_SHOWCASE_PM_SLUG ||
    idOrSlug === `studio-${DEMO_SHOWCASE_STUDIO_ID}`
  );
}

export function isViewerRole(role: AuthRole | null | undefined): boolean {
  return role === "viewer";
}

/** 虚构产品：对外演示「灵感→需求→任务」叙事，不含真实私域项目 */
export function buildDemoShowcaseStudioProject(): Project {
  return {
    id: DEMO_SHOWCASE_STUDIO_ID,
    title: "晨光手记（演示）",
    positioning: "轻量日记 App — 用 Star PM 演示「灵感 → 需求池 → 迭代」",
    targetUser: "想记录日常、偶尔回看情绪曲线的年轻职场人",
    status: "demo",
    priority: "P1",
    currentStage: "演示版 · MVP 已可用",
    nextAction: "对外讲解：灵感入库 → 拆条进需求池 → 任务关账",
    demoUrl: "https://star-project-manage.vercel.app",
    localRunGuide: null,
    codePath: null,
    githubRepo: null,
    githubBranch: "main",
    lastCommitSha: null,
    lastGitSyncedAt: null,
    vercelUrl: null,
    lastCommitMessage: null,
    lastCommitAt: null,
    relatedPageUrl: null,
    portfolioValue: "对外演示数据集：无真实客户/私密项目",
    customFields: { showcase: true },
    parentId: null,
    featureModules: ["记录·快写", "回顾·情绪曲线", "提醒·晚间小结"],
    body: {
      initialThought: "想做一款打开就能写三句的日记，晚上自动提醒回顾。",
      whyThought: "市面日记太重；用轻量闭环讲清产品管理流程更合适做 Demo。",
      positioning: "晨光手记 — 快写 + 轻回顾，不是社交、不是笔记库。",
      iterations: "v0.1 快写 → v0.2 情绪标签 → v0.3 晚间提醒（演示）",
      done: "快写页、情绪标签、演示用需求池与任务",
      notDone: "真实推送、账号体系（演示不做）",
      nextStep: "观看者走一遍：灵感流 → 需求表 → 工作台",
      links: "本数据集仅用于 Star PM 对外演示",
      retrospectives: "定位为演示沙盘，刻意不含真实业务项目。",
    },
    createdAt: T0,
    updatedAt: T3,
  };
}

export function buildDemoShowcaseIdeas(): Idea[] {
  return [
    {
      id: "idea-demo-001",
      title: "三句快写代替长文日记",
      oneLineIdea: "打开 App 只写三句：事 / 感受 / 明天一句",
      whyItMatters: "降低写作门槛，演示「灵感如何变成需求」",
      triggerSource: "演示脚本",
      emotionLevel: "like",
      type: "product",
      priority: "P1",
      rawInput: "对外讲解用：从一句吐槽到可排期需求",
      relatedProjectId: DEMO_SHOWCASE_STUDIO_ID,
      relatedIdeaId: null,
      relatedModule: "记录·快写",
      subtasks: [],
      status: "converted",
      suggestedNextStep: "已进需求池父 epic",
      chatTopic: "演示·晨光手记",
      aiSupplement: "",
      sourceChat: "demo",
      sourceMethod: "手动",
      decisionNotes: "作为演示主灵感",
      evolutionNotes: "",
      relatedAssetsNote: "",
      githubIssueNumber: null,
      githubIssueUrl: null,
      githubLabels: [],
      occurredAt: T0,
      completedAt: T1,
      createdAt: T0,
      updatedAt: T1,
    },
    {
      id: "idea-demo-002",
      title: "晚间小结提醒",
      oneLineIdea: "21:30 轻提醒回顾当天三句",
      whyItMatters: "演示「未做完也可挂停车场」",
      triggerSource: "演示脚本",
      emotionLevel: "normal",
      type: "feature",
      priority: "P2",
      rawInput: "",
      relatedProjectId: DEMO_SHOWCASE_STUDIO_ID,
      relatedIdeaId: "idea-demo-001",
      relatedModule: "提醒·晚间小结",
      subtasks: [],
      status: "parked",
      suggestedNextStep: "演示版不接真实推送",
      chatTopic: "演示·晨光手记",
      aiSupplement: "",
      sourceChat: "demo",
      sourceMethod: "手动",
      decisionNotes: "停车场示例",
      evolutionNotes: "",
      relatedAssetsNote: "",
      githubIssueNumber: null,
      githubIssueUrl: null,
      githubLabels: [],
      occurredAt: T1,
      completedAt: null,
      createdAt: T1,
      updatedAt: T2,
    },
    {
      id: "idea-demo-003",
      title: "情绪曲线周回顾",
      oneLineIdea: "用情绪标签画一周折线，不做心理测评",
      whyItMatters: "演示已完成灵感关账",
      triggerSource: "演示脚本",
      emotionLevel: "like",
      type: "feature",
      priority: "P1",
      rawInput: "",
      relatedProjectId: DEMO_SHOWCASE_STUDIO_ID,
      relatedIdeaId: "idea-demo-001",
      relatedModule: "回顾·情绪曲线",
      subtasks: [],
      status: "done",
      suggestedNextStep: "",
      chatTopic: "演示·晨光手记",
      aiSupplement: "",
      sourceChat: "demo",
      sourceMethod: "手动",
      decisionNotes: "",
      evolutionNotes: "",
      relatedAssetsNote: "",
      githubIssueNumber: null,
      githubIssueUrl: null,
      githubLabels: [],
      occurredAt: T1,
      completedAt: T2,
      createdAt: T1,
      updatedAt: T2,
    },
  ];
}

export function buildDemoShowcaseTasks(): StudioTask[] {
  return [
    {
      id: "task-demo-001",
      title: "快写页信息架构",
      projectId: DEMO_SHOWCASE_STUDIO_ID,
      status: "done",
      priority: "P0",
      workload: "1d",
      blocker: null,
      startDate: "2026-06-10",
      endDate: "2026-06-15",
      dueDate: "2026-06-20",
      estimateHours: 8,
      actualHours: 6,
      progressNote: "演示：已关账任务",
      sourceIdeaId: "idea-demo-001",
      completionSource: "manual",
      gitCommitSha: null,
      gitCommitMessage: null,
      completedAt: T1,
    },
    {
      id: "task-demo-002",
      title: "情绪标签 6 色",
      projectId: DEMO_SHOWCASE_STUDIO_ID,
      status: "done",
      priority: "P1",
      workload: "0.5d",
      blocker: null,
      startDate: "2026-06-20",
      endDate: "2026-07-01",
      dueDate: "2026-07-01",
      estimateHours: 4,
      actualHours: 4,
      progressNote: "",
      sourceIdeaId: "idea-demo-003",
      completionSource: "manual",
      gitCommitSha: null,
      gitCommitMessage: null,
      completedAt: T2,
    },
    {
      id: "task-demo-003",
      title: "晚间提醒文案（演示占位）",
      projectId: DEMO_SHOWCASE_STUDIO_ID,
      status: "todo",
      priority: "P2",
      workload: "0.5d",
      blocker: null,
      startDate: null,
      endDate: null,
      dueDate: null,
      estimateHours: 2,
      actualHours: null,
      progressNote: "停车场灵感对应任务",
      sourceIdeaId: "idea-demo-002",
      completionSource: null,
      gitCommitSha: null,
      gitCommitMessage: null,
      completedAt: null,
    },
  ];
}

export function buildDemoShowcaseEvolutions(): EvolutionLog[] {
  return [
    {
      id: "evo-demo-001",
      projectId: DEMO_SHOWCASE_STUDIO_ID,
      title: "立项：晨光手记演示沙盘",
      logType: "initial",
      before: "",
      after: "用虚构日记产品演示 Star PM 全流程，不挂真实业务",
      reason: "对外观看者需要可讲的完整故事线",
      decision: "固定 ID proj-demo-showcase，观看者登录仅见此项目",
      module: "项目库",
      releaseTag: null,
      createdAt: T0,
    },
    {
      id: "evo-demo-002",
      projectId: DEMO_SHOWCASE_STUDIO_ID,
      title: "MVP：三句快写上线（演示）",
      logType: "feature_add",
      before: "只有灵感描述",
      after: "需求池有父 epic + 子功能；任务可关账",
      reason: "演示拆条与完成态",
      decision: "保持数据量小、叙事清晰",
      module: "需求任务",
      releaseTag: "v0.1.0-demo",
      createdAt: T1,
    },
    {
      id: "evo-demo-003",
      projectId: DEMO_SHOWCASE_STUDIO_ID,
      title: "情绪曲线周回顾完成",
      logType: "feature_add",
      before: "仅有标签",
      after: "周回顾示意页完成（演示）",
      reason: "展示「已完成」演进",
      decision: "关账示例",
      module: "迭代记录",
      releaseTag: "v0.2.0-demo",
      createdAt: T2,
    },
  ];
}

export function buildDemoShowcaseAssets(): Asset[] {
  return [
    {
      id: "asset-demo-001",
      projectId: DEMO_SHOWCASE_STUDIO_ID,
      title: "演示脚本 · 5 分钟讲解",
      assetType: "doc",
      url: "",
      storagePath: null,
      mimeType: null,
      note: "1 灵感流 → 2 需求表父子 → 3 工作台 → 4 演进时间线",
      takeaway: "对外只讲流程，不讲私密项目",
      risk: null,
    },
  ];
}

export function buildDemoShowcaseSlice(): Pick<
  StudioSnapshot,
  "projects" | "ideas" | "evolutionLogs" | "tasks" | "assets" | "releases" | "changeSessions"
> {
  return {
    projects: [buildDemoShowcaseStudioProject()],
    ideas: buildDemoShowcaseIdeas(),
    evolutionLogs: buildDemoShowcaseEvolutions(),
    tasks: buildDemoShowcaseTasks(),
    assets: buildDemoShowcaseAssets(),
    releases: [],
    changeSessions: [],
  };
}

export function filterStudioSnapshotForDemo(snapshot: StudioSnapshot): StudioSnapshot {
  const id = DEMO_SHOWCASE_STUDIO_ID;
  return {
    ...snapshot,
    projects: snapshot.projects.filter((p) => p.id === id),
    ideas: snapshot.ideas.filter((i) => i.relatedProjectId === id),
    evolutionLogs: snapshot.evolutionLogs.filter((e) => e.projectId === id),
    tasks: snapshot.tasks.filter((t) => t.projectId === id),
    assets: snapshot.assets.filter((a) => a.projectId === id),
    releases: (snapshot.releases ?? []).filter((r) => r.projectId === id),
    projectColumnDefs: snapshot.projectColumnDefs ?? [],
    changeSessions: (snapshot.changeSessions ?? []).filter((c) => c.projectId === id),
  };
}

export function filterPmProjectsForDemo<T extends { id: string; slug: string }>(projects: T[]): T[] {
  return projects.filter((p) => isDemoShowcaseId(p.slug) || isDemoShowcaseId(p.id));
}
