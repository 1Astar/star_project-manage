export type IdeaType = "product" | "feature" | "ui" | "content" | "tech" | "business";
export type EmotionLevel = "normal" | "like" | "excited";
export type IdeaStatus =
  | "inbox"
  | "reviewing"
  | "converted"
  | "done"
  | "parked"
  | "archived";

export type ProjectStatus = "mainline" | "active" | "demo" | "parking" | "archived";
export type ProjectPriority = "P0" | "P1" | "P2" | "P3";

export type StudioProjectColumnType =
  | "text"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "url";

export type StudioCustomFieldValue = string | number | boolean | null;

export interface StudioProjectColumnDef {
  id: string;
  key: string;
  label: string;
  columnType: StudioProjectColumnType;
  options: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export type EvolutionLogType =
  | "initial"
  | "positioning"
  | "feature_add"
  | "feature_cut"
  | "tech_decision"
  | "ui_change"
  | "stage_review";

export type TaskStatus = "todo" | "in_progress" | "done" | "paused";
export type TaskPriority = "P0" | "P1" | "P2" | "P3";
export type IdeaPriority = TaskPriority;

export interface IdeaSubtask {
  title: string;
  priority: TaskPriority;
  rationale: string;
}

export type AssetType =
  | "experience"
  | "repo"
  | "design"
  | "doc"
  | "material"
  | "prompt"
  | "api"
  | "deploy"
  | "video"
  /** @deprecated 读库兼容，展示时归一到 material / design / doc */
  | "competitor"
  | "ui_ref"
  | "tech_doc"
  | "inspiration";

export interface Idea {
  id: string;
  title: string;
  oneLineIdea: string;
  whyItMatters: string;
  /** AI 补充全文（导入模板「AI补充」） */
  aiSupplement: string;
  /** 聊天主题 */
  chatTopic: string;
  triggerSource: string;
  /** 来源聊天标题/会话名 */
  sourceChat: string;
  /** 来源方式：ChatGPT / 手动 / GitHub / Notion … */
  sourceMethod: string;
  emotionLevel: EmotionLevel;
  type: IdeaType;
  priority: IdeaPriority;
  rawInput: string;
  relatedProjectId: string | null;
  /** 父 Idea */
  relatedIdeaId: string | null;
  /** 关联模块名称 */
  relatedModule: string;
  subtasks: IdeaSubtask[];
  status: IdeaStatus;
  suggestedNextStep: string;
  decisionNotes: string;
  evolutionNotes: string;
  relatedAssetsNote: string;
  githubIssueNumber: number | null;
  githubIssueUrl: string | null;
  githubLabels: string[];
  /** 灵感发生时间（脑暴当时）；缺省回退 createdAt */
  occurredAt: string;
  /** 实际完成时间；标为 done 时自动写入，可改 */
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBody {
  initialThought: string;
  whyThought: string;
  positioning: string;
  iterations: string;
  done: string;
  notDone: string;
  nextStep: string;
  links: string;
  retrospectives: string;
}

export interface Project {
  id: string;
  title: string;
  positioning: string;
  targetUser: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  currentStage: string;
  nextAction: string;
  demoUrl: string | null;
  localRunGuide: string | null;
  codePath: string | null;
  githubRepo: string | null;
  githubBranch: string;
  vercelUrl: string | null;
  lastCommitSha: string | null;
  lastCommitMessage: string | null;
  lastCommitAt: string | null;
  lastGitSyncedAt: string | null;
  relatedPageUrl: string | null;
  portfolioValue: string;
  customFields: Record<string, StudioCustomFieldValue>;
  body: ProjectBody;
  /** 父项目 id；仅支持一层，null 为顶层 */
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvolutionLog {
  id: string;
  title: string;
  projectId: string;
  logType: EvolutionLogType;
  before: string;
  after: string;
  reason: string;
  decision: string;
  createdAt: string;
}

export type TaskCompletionSource = "manual" | "git";

export interface StudioTask {
  id: string;
  title: string;
  projectId: string;
  status: TaskStatus;
  priority: TaskPriority;
  workload: string;
  blocker: string | null;
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  actualHours: number | null;
  completedAt: string | null;
  progressNote: string;
  completionSource: TaskCompletionSource | null;
  gitCommitSha: string | null;
  gitCommitMessage: string | null;
  sourceIdeaId: string | null;
}

export interface Asset {
  id: string;
  title: string;
  projectId: string;
  assetType: AssetType;
  url: string;
  storagePath: string | null;
  mimeType: string | null;
  note: string;
  takeaway: string;
  risk: string | null;
}

/** 从 GitHub 同步的 Release / Tag */
export interface StudioRelease {
  id: string;
  projectId: string;
  tag: string;
  name: string;
  publishedAt: string | null;
  body: string;
  htmlUrl: string;
  isPrerelease: boolean;
  /** release = GitHub Release；tag = 仅 Tag */
  source: "release" | "tag";
  syncedAt: string;
}

export const IDEA_TYPE_LABELS: Record<IdeaType, string> = {
  product: "产品",
  feature: "功能",
  ui: "UI",
  content: "内容",
  tech: "技术",
  business: "商业",
};

export const EMOTION_LABELS: Record<EmotionLevel, string> = {
  normal: "普通",
  like: "喜欢",
  excited: "很想做",
};

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  inbox: "灵感池",
  reviewing: "验证中",
  converted: "已转项目",
  done: "已完成",
  parked: "停车场",
  archived: "已归档",
};

export const IDEA_SOURCE_OPTIONS = ["ChatGPT", "手动", "GitHub", "Notion"] as const;
export type IdeaSource = (typeof IDEA_SOURCE_OPTIONS)[number];

export const IDEA_TYPE_CAPTURE_LABELS: Record<string, IdeaType> = {
  产品想法: "product",
  功能想法: "feature",
  UI想法: "ui",
  技术想法: "tech",
  内容想法: "content",
  商业想法: "business",
  作品集想法: "business",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  mainline: "主线",
  active: "进行中",
  demo: "展示版",
  parking: "停车场",
  archived: "已归档",
};

export const EVOLUTION_TYPE_LABELS: Record<EvolutionLogType, string> = {
  initial: "初始想法",
  positioning: "定位变化",
  feature_add: "功能新增",
  feature_cut: "砍掉功能",
  tech_decision: "技术决策",
  ui_change: "UI 调整",
  stage_review: "阶段复盘",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "待做",
  in_progress: "进行中",
  done: "已完成",
  paused: "暂停",
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  experience: "在线体验",
  repo: "代码仓库",
  design: "设计稿",
  doc: "文档",
  material: "素材",
  prompt: "Prompt",
  api: "API",
  deploy: "部署",
  video: "视频",
  competitor: "竞品",
  ui_ref: "UI 参考",
  tech_doc: "技术文档",
  inspiration: "灵感",
};

/** 新建时可选的资源类型（不含废弃项） */
export const ASSET_TYPE_CREATE_OPTIONS: AssetType[] = [
  "experience",
  "repo",
  "design",
  "doc",
  "material",
  "prompt",
  "api",
  "deploy",
  "video",
];
