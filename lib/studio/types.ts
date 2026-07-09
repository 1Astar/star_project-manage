export type IdeaType = "product" | "feature" | "ui" | "content" | "tech" | "business";
export type EmotionLevel = "normal" | "like" | "excited";
export type IdeaStatus = "inbox" | "converted" | "parked" | "archived";

export type ProjectStatus = "mainline" | "active" | "demo" | "parking" | "archived";
export type ProjectPriority = "P0" | "P1" | "P2" | "P3";

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
  | "competitor"
  | "ui_ref"
  | "tech_doc"
  | "video"
  | "material"
  | "inspiration";

export interface Idea {
  id: string;
  title: string;
  oneLineIdea: string;
  whyItMatters: string;
  triggerSource: string;
  emotionLevel: EmotionLevel;
  type: IdeaType;
  priority: IdeaPriority;
  rawInput: string;
  relatedProjectId: string | null;
  relatedIdeaId: string | null;
  subtasks: IdeaSubtask[];
  status: IdeaStatus;
  createdAt: string;
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
  relatedPageUrl: string | null;
  portfolioValue: string;
  body: ProjectBody;
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

export interface StudioTask {
  id: string;
  title: string;
  projectId: string;
  status: TaskStatus;
  priority: TaskPriority;
  workload: string;
  blocker: string | null;
  dueDate: string | null;
}

export interface Asset {
  id: string;
  title: string;
  projectId: string;
  assetType: AssetType;
  url: string;
  note: string;
  takeaway: string;
  risk: string | null;
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
  normal: "一般",
  like: "喜欢",
  excited: "啊啊啊好想做",
};

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  inbox: "收件箱",
  converted: "已转项目",
  parked: "停车场",
  archived: "已归档",
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
  competitor: "竞品",
  ui_ref: "UI 参考",
  tech_doc: "技术文档",
  video: "视频",
  material: "素材",
  inspiration: "灵感",
};
