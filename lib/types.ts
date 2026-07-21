export type TaskStatus =
  | "pending"
  | "in_progress"
  | "integration"
  | "testing"
  | "acceptance"
  | "done"
  | "blocked";

export type RoleType =
  | "product"
  | "ui"
  | "hardware"
  | "embedded"
  | "backend"
  | "frontend"
  | "algorithm"
  | "test";

export type EstimateLevel = "module" | "requirement";

export type DeployStatus = "ready" | "building" | "error";

export type RequirementType = "epic" | "feature" | "task";

/** 表格/表单展示用中文（存储仍为 epic/feature/task） */
export const REQUIREMENT_TYPE_LABELS: Record<RequirementType, string> = {
  epic: "大型模块",
  feature: "功能",
  task: "任务",
};

export type LinkEntityType = "requirement" | "idea" | "evolution" | "studio_task";

export type LinkRelationType =
  | "inspired_by"
  | "from_idea"
  | "has_task"
  | "has_evolution";

export interface RequirementLink {
  id: string;
  project_id: string;
  source_type: LinkEntityType;
  source_id: string;
  target_type: LinkEntityType;
  target_id: string;
  relation_type: LinkRelationType;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** 父项目 id；仅支持一层，null 为顶层 */
  parent_id: string | null;
  pool_tag_options: string[];
  created_at: string;
  repo_full_name: string | null;
  repo_branch: string | null;
  repo_url: string | null;
  last_commit_sha: string | null;
  last_commit_message: string | null;
  last_commit_at: string | null;
  last_git_synced_at: string | null;
  vercel_project_id: string | null;
  vercel_deployment_url: string | null;
  last_deploy_status: DeployStatus | null;
  demo_url: string | null;
  local_run_guide: string | null;
  code_path: string | null;
}

export interface GitActivity {
  id: string;
  project_id: string;
  repo_full_name: string;
  branch: string;
  commit_sha: string;
  short_sha: string;
  message: string;
  author: string;
  committed_at: string;
  url: string;
  synced_at: string;
}

export interface Iteration {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  /** YYYY-MM-DD；空则无法判「未开始/已过期」 */
  start_date: string | null;
  end_date: string | null;
  /** 绑定的 GitHub Release/Tag */
  release_tag: string | null;
}

export interface ModuleNode {
  id: string;
  iteration_id: string;
  parent_id: string | null;
  name: string;
  level: 1 | 2;
  estimate_level: EstimateLevel;
  module_estimate_hours: number | null;
  sort_order: number;
}

export type PoolColumnType = "text" | "number" | "date" | "checkbox" | "select" | "url";

export interface PoolColumnDef {
  id: string;
  project_id: string;
  key: string;
  label: string;
  column_type: PoolColumnType;
  options: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Requirement {
  id: string;
  project_id: string;
  iteration_id: string;
  module_l1_id: string | null;
  module_l2_id: string | null;
  /** 子需求树：指向父需求；根为 null */
  parent_id: string | null;
  /** epic / feature / task（库字段 req_type） */
  type: RequirementType;
  title: string;
  sub_function: string | null;
  detail_work: string | null;
  acceptance_criteria: string | null;
  priority: string | null;
  /** 看板/任务机读兼容；产品侧以 status_tags 为准 */
  status: TaskStatus;
  /** 可自建的状态标签（含「完成」「评审」等），可读可写 */
  status_tags: string[];
  /** 需求指派，多选 */
  assignees: string[];
  req_source: string | null;
  req_source_note: string | null;
  inspiration_source: string | null;
  next_step: string | null;
  completed_at: string | null;
  /** 从 Studio 灵感迁入时去重 */
  studio_idea_id: string | null;
  blocker_reason: string | null;
  sort_order: number;
  in_pool: boolean;
  category: string | null;
  stage_type: string | null;
  optimization_notes: string | null;
  known_issues: string | null;
  submitted_at: string | null;
  due_date: string | null;
  difficulty_notes: string | null;
  scenario: string | null;
  needs_discussion: boolean;
  prd_link: string | null;
  prototype_link: string | null;
  /** 叶子节点自身预计工时 */
  product_estimate_hours: number | null;
  /** 非叶节点自身直接执行工时（不计入叶子 SUM 重复，展示时加在 Σ叶子 上） */
  direct_hours: number | null;
  actual_hours: number | null;
  /** 强制关闭父需求（已取消），不再被自动完成覆盖 */
  force_closed: boolean;
  tags: string[];
  custom_fields: Record<string, string | number | boolean | null>;
  created_at: string;
  updated_at: string;
}

export const REQUIREMENT_POOL_DEFAULTS: Pick<
  Requirement,
  | "in_pool"
  | "category"
  | "stage_type"
  | "optimization_notes"
  | "known_issues"
  | "submitted_at"
  | "due_date"
  | "difficulty_notes"
  | "scenario"
  | "needs_discussion"
  | "prd_link"
  | "prototype_link"
  | "product_estimate_hours"
  | "direct_hours"
  | "actual_hours"
  | "force_closed"
  | "parent_id"
  | "type"
  | "tags"
  | "custom_fields"
  | "status_tags"
  | "assignees"
  | "req_source"
  | "req_source_note"
  | "inspiration_source"
  | "next_step"
  | "completed_at"
  | "studio_idea_id"
> = {
  in_pool: false,
  category: null,
  stage_type: null,
  optimization_notes: null,
  known_issues: null,
  submitted_at: null,
  due_date: null,
  difficulty_notes: null,
  scenario: null,
  needs_discussion: false,
  prd_link: null,
  prototype_link: null,
  product_estimate_hours: null,
  direct_hours: null,
  actual_hours: null,
  force_closed: false,
  parent_id: null,
  type: "task",
  tags: [],
  custom_fields: {},
  status_tags: ["待开始"],
  assignees: [],
  req_source: null,
  req_source_note: null,
  inspiration_source: null,
  next_step: null,
  completed_at: null,
  studio_idea_id: null,
};

export type RequirementUpdates = Partial<{
  title: string | null;
  sub_function: string | null;
  detail_work: string | null;
  acceptance_criteria: string | null;
  priority: string | null;
  status: TaskStatus;
  status_tags: string[];
  assignees: string[];
  req_source: string | null;
  req_source_note: string | null;
  inspiration_source: string | null;
  next_step: string | null;
  completed_at: string | null;
  studio_idea_id: string | null;
  category: string | null;
  stage_type: string | null;
  optimization_notes: string | null;
  known_issues: string | null;
  sort_order: number;
  module_l1_id: string | null;
  module_l2_id: string | null;
  parent_id: string | null;
  type: RequirementType;
  submitted_at: string | null;
  due_date: string | null;
  difficulty_notes: string | null;
  scenario: string | null;
  needs_discussion: boolean;
  prd_link: string | null;
  prototype_link: string | null;
  product_estimate_hours: number | null;
  direct_hours: number | null;
  actual_hours: number | null;
  force_closed: boolean;
  tags: string[];
  custom_fields: Record<string, string | number | boolean | null>;
}>;

export interface AcceptanceItem {
  id: string;
  requirement_id: string;
  description: string;
  passed: boolean | null;
  note: string | null;
  sort_order: number;
}

export interface RoleTask {
  id: string;
  requirement_id: string;
  role: RoleType;
  assignee: string | null;
  estimate_hours: number | null;
  actual_hours: number | null;
  start_date: string | null;
  end_date: string | null;
  status: TaskStatus;
  notes: string | null;
  blocker_reason: string | null;
  progress_percent: number | null;
  updated_at: string;
}

export interface TestRecord {
  id: string;
  requirement_id: string;
  role_task_id: string | null;
  passed: boolean;
  issue_description: string | null;
  tester_name: string;
  created_at: string;
}

export interface AcceptanceRecord {
  id: string;
  requirement_id: string;
  acceptance_item_id: string;
  passed: boolean;
  note: string | null;
  reviewer_name: string;
  created_at: string;
}

/** 严重程度：1 最高 … 4 最低（对齐禅道） */
export type BugSeverity = 1 | 2 | 3 | 4;

export type BugType =
  | "code"
  | "ui"
  | "performance"
  | "security"
  | "design"
  | "config"
  | "install"
  | "other";

export const BUG_SEVERITY_LABELS: Record<BugSeverity, string> = {
  1: "1 · 致命",
  2: "2 · 严重",
  3: "3 · 一般",
  4: "4 · 轻微",
};

export const BUG_TYPE_LABELS: Record<BugType, string> = {
  code: "代码错误",
  ui: "界面优化",
  performance: "性能问题",
  security: "安全相关",
  design: "设计缺陷",
  config: "配置相关",
  install: "安装部署",
  other: "其他",
};

export interface Bug {
  id: string;
  project_id: string;
  requirement_id: string | null;
  title: string;
  description: string | null;
  repro_steps: string | null;
  assignee: string | null;
  status: TaskStatus;
  /** 1 最高 … 4 最低 */
  severity: BugSeverity;
  bug_type: BugType;
  created_at: string;
  updated_at: string;
}

export interface RequirementAttachment {
  id: string;
  project_id: string;
  requirement_id: string;
  title: string;
  url: string;
  storage_path: string | null;
  mime_type: string | null;
  created_at: string;
}

export interface ShareLink {
  id: string;
  project_id: string;
  role: RoleType | "readonly" | "test" | "admin";
  label: string;
  token_hash: string;
  is_active: boolean;
  created_at: string;
}

export interface Prototype {
  id: string;
  project_id: string;
  name: string;
  type: "html_zip" | "external_url";
  storage_path: string | null;
  external_url: string | null;
  requirement_id: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  project_id: string;
  recipient_name: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  actor_name: string;
  actor_role: string | null;
  created_at: string;
}

export interface RequirementComment {
  id: string;
  project_id: string;
  requirement_id: string;
  author_name: string;
  author_role: string | null;
  body: string;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  name: string;
  role: RoleType | null;
  is_active: boolean;
  created_at: string;
}

export interface ProjectStats {
  totalTasks: number;
  doneTasks: number;
  blockedTasks: number;
  testingTasks: number;
  acceptanceTasks: number;
  progressPercent: number;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "待开始",
  in_progress: "开发中",
  integration: "待联调",
  testing: "待测试",
  acceptance: "待验收",
  done: "已完成",
  blocked: "阻塞",
};

/** 含此标签视为已完成，并写入 completed_at */
export const REQUIREMENT_DONE_TAG = "完成";

/** 强制关闭 / 取消方向 */
export const REQUIREMENT_CANCELLED_TAG = "已取消";

export function requirementIsDone(req: Pick<Requirement, "status_tags" | "status">): boolean {
  const tags = req.status_tags ?? [];
  if (tags.some((t) => t === REQUIREMENT_DONE_TAG || t === "已完成" || t === "已做")) {
    return true;
  }
  return req.status === "done";
}

export function requirementIsCancelled(
  req: Pick<Requirement, "status_tags" | "force_closed">
): boolean {
  if (req.force_closed) return true;
  return (req.status_tags ?? []).some(
    (t) => t === REQUIREMENT_CANCELLED_TAG || t === "取消"
  );
}

export function deriveTaskStatusFromTags(tags: string[]): TaskStatus {
  const set = new Set(tags);
  if (set.has(REQUIREMENT_DONE_TAG) || set.has("已完成") || set.has("已做")) return "done";
  if (set.has(REQUIREMENT_CANCELLED_TAG) || set.has("取消")) return "blocked";
  if (set.has("阻塞")) return "blocked";
  if (set.has("待验收") || set.has("验收")) return "acceptance";
  if (set.has("待测试") || set.has("测试")) return "testing";
  if (set.has("待联调") || set.has("联调")) return "integration";
  if (set.has("开发中") || set.has("进行中") || set.has("评审")) return "in_progress";
  if (set.has("待开始")) return "pending";
  return tags.length ? "in_progress" : "pending";
}

export function statusTagsFromTaskStatus(status: TaskStatus): string[] {
  if (status === "done") return [REQUIREMENT_DONE_TAG];
  return [TASK_STATUS_LABELS[status]];
}

export const ROLE_LABELS: Record<RoleType, string> = {
  product: "产品",
  ui: "UI",
  hardware: "硬件",
  embedded: "嵌入式",
  backend: "后端",
  frontend: "前端",
  algorithm: "算法",
  test: "测试",
};

export const TASK_STATUS_FLOW: TaskStatus[] = [
  "pending",
  "in_progress",
  "integration",
  "testing",
  "acceptance",
  "done",
];
