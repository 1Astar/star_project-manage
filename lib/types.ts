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
  /** YYYY-MM-DD；空则无法判「未开始/延期」 */
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
  /** 相对根的深度，1 起；任意多层 */
  level: number;
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
  /** 强制关闭父需求（放弃），不再被自动完成覆盖 */
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
  status_tags: ["想法"],
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
  /** 挂到规划迭代（可仍留在需求池 in_pool=true） */
  iteration_id: string;
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

export type BuiltinBugType =
  | "code"
  | "ui"
  | "performance"
  | "security"
  | "design"
  | "config"
  | "install"
  | "other";

export type BugType = BuiltinBugType | `custom:${string}`;

export const BUG_SEVERITY_LABELS: Record<BugSeverity, string> = {
  1: "1 · 致命",
  2: "2 · 严重",
  3: "3 · 一般",
  4: "4 · 轻微",
};

export const BUG_TYPE_LABELS: Record<BuiltinBugType, string> = {
  code: "代码错误",
  ui: "界面优化",
  performance: "性能问题",
  security: "安全相关",
  design: "设计缺陷",
  config: "配置相关",
  install: "安装部署",
  other: "其他",
};

/** 测试计划（轻量实体；不含用例库 / 执行记录） */
export type BugTestPlanStatus = "active" | "archived";

export interface BugTestPlan {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: BugTestPlanStatus;
  created_at: string;
  updated_at: string;
}

export interface Bug {
  id: string;
  project_id: string;
  requirement_id: string | null;
  /** 关联测试计划 */
  test_plan_id: string | null;
  /** 关联规划迭代（期） */
  iteration_id: string | null;
  title: string;
  description: string | null;
  /** 前置条件 */
  precondition: string | null;
  /** 复现步骤 */
  repro_steps: string | null;
  /** 预期结果 */
  expected_result: string | null;
  /** 实际结果 */
  actual_result: string | null;
  /** 优化建议（给 +1 / 研发） */
  suggestion: string | null;
  /** 功能模块（对齐项目板块 featureModules） */
  module_path: string | null;
  /** 发现版本（自由文本） */
  found_version: string | null;
  /** 解决版本（自由文本） */
  resolved_version: string | null;
  /** 环境标签 */
  environments: string[];
  /**
   * 优先级 P0–P3（处理先后）
   * 与 severity（严重程度 / 影响面）分开
   */
  priority: "P0" | "P1" | "P2" | "P3" | null;
  assignee: string | null;
  /** 报告人（创建时写入；只读展示） */
  reporter_name: string | null;
  /** 最近更新人显示名 */
  updated_by: string | null;
  /** 关注人；状态变更 / 评论时通知 */
  watchers: string[];
  status: TaskStatus;
  /** 严重程度：1 致命 … 4 轻微 */
  severity: BugSeverity;
  bug_type: BugType;
  /** 关联执行用例（自由文本；本期无用例库） */
  execution_case: string | null;
  /** 可选：关联学习知识点 */
  linked_learning_note_ids: string[];
  /** 可选：关联竞品条目 */
  linked_competitor_ids: string[];
  /** 自定义列值 key → 标量 */
  custom_fields: Record<string, string | number | boolean | null>;
  created_at: string;
  updated_at: string;
}

/** 项目内竞品条目（可被学习 / 需求 / Bug 交叉引用） */
export interface CompetitorEntry {
  id: string;
  project_id: string;
  title: string;
  summary: string;
  /** 外链（产品页 / 资料等） */
  url: string | null;
  module_path: string | null;
  linked_learning_note_ids: string[];
  linked_requirement_ids: string[];
  linked_bug_ids: string[];
  created_at: string;
  updated_at: string;
}

/** 项目内嵌工作簿（FortuneSheet JSON；一期不与实体同步） */
export interface ProjectWorkbook {
  id: string;
  project_id: string;
  title: string;
  /** FortuneSheet Sheet[] JSON */
  sheet_data: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

/** 学习笔记里的一条优化建议（可一键生成需求） */
export interface LearningSuggestion {
  id: string;
  title: string;
  detail: string;
  /** 已一键生成或手动挂上的需求 id */
  linked_requirement_id: string | null;
  created_at: string;
}

/** 学习池节点层级：板块 → 主题 → 子知识点 */
export type LearningNoteKind = "section" | "topic" | "point";

/** 项目学习池条目（个人学习：原理 / 协议 / 竞品等） */
export interface ProjectLearningNote {
  id: string;
  project_id: string;
  title: string;
  /** section=板块 / topic=主题 / point=子知识点 */
  kind: LearningNoteKind;
  /** 父节点；板块为空；主题挂板块；子挂主题 */
  parent_id: string | null;
  /** 同级排序，小在前 */
  sort_order: number;
  /** 为什么？ */
  why_text: string;
  /** 原理 */
  principle: string;
  /** 协议 */
  protocol: string;
  /** 技术背景 */
  tech_background: string;
  /** 竞品 */
  competitors: string;
  /** 更底层的产品思考 */
  product_thinking: string;
  /** 关联需求 id（可多选；含建议生成的需求） */
  linked_requirement_ids: string[];
  /** 可选：关联竞品条目 */
  linked_competitor_ids: string[];
  /** 可选：关联 Bug */
  linked_bug_ids: string[];
  /** 优化建议（尚未/已生成需求） */
  suggestions: LearningSuggestion[];
  created_at: string;
  updated_at: string;
}

/** 学习笔记附件（截图 / 文件） */
export interface LearningNoteAttachment {
  id: string;
  project_id: string;
  note_id: string;
  title: string;
  url: string;
  storage_path: string | null;
  mime_type: string | null;
  created_at: string;
}

/** Wiki 页宿主：模块主页或总览实体（Notion 风层层子页） */
export type WikiPageHostKind =
  | "module"
  | "requirement"
  | "bug"
  | "learning"
  | "prd"
  | "competitor";

/**
 * 项目 Wiki 页树（任意嵌套）。
 * 根页挂在 host（模块名或实体 id）；子页用 parent_id，host 字段继承根页。
 */
export interface ProjectWikiPage {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  body: string;
  sort_order: number;
  host_kind: WikiPageHostKind;
  /** module=模块名；其余=实体 id */
  host_key: string;
  created_at: string;
  updated_at: string;
}

/** PRD 内挂载的原型引用 */
export interface PrdPrototypeLink {
  prototype_id: string;
  note: string;
  /** 正文锚点提示（段落摘要等） */
  section_hint: string;
}

/** 项目 PRD 文档（服务端正文） */
/** PRD 文档内的小版本（1.0 / 1.0.1…，不是项目大版本） */
export interface PrdDocVersion {
  id: string;
  label: string;
  html_content: string;
  created_at: string;
}

export interface ProjectPrd {
  id: string;
  project_id: string;
  title: string;
  /** 功能板块路径，如「通知消息」或「APP重构·通知消息」 */
  module_path: string | null;
  html_content: string;
  /** 单独分享用明文 token；库内可空 */
  share_token: string | null;
  linked_prototypes: PrdPrototypeLink[];
  versions: PrdDocVersion[];
  created_at: string;
  updated_at: string;
}

/** PRD 审阅评论 */
export interface PrdReviewComment {
  id: string;
  prd_id: string;
  project_id: string;
  anchor_text: string;
  anchor_selector: string | null;
  body: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export interface BugAttachment {
  id: string;
  project_id: string;
  bug_id: string;
  title: string;
  url: string;
  storage_path: string | null;
  mime_type: string | null;
  created_at: string;
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

/** 待验证假设状态 */
export type InterviewHypothesisStatus =
  | "open"
  | "validating"
  | "confirmed"
  | "rejected";

export const INTERVIEW_HYPOTHESIS_STATUS_LABELS: Record<
  InterviewHypothesisStatus,
  string
> = {
  open: "待验证",
  validating: "验证中",
  confirmed: "已证实",
  rejected: "已证伪",
};

export interface InterviewHypothesis {
  id: string;
  statement: string;
  status: InterviewHypothesisStatus;
}

/** 项目访谈：记录 + 产品判断 + 假设；经 link 挂需求 */
export interface ProjectInterview {
  id: string;
  project_id: string;
  title: string;
  interviewee: string | null;
  interviewed_at: string | null;
  record_notes: string;
  product_judgment: string;
  hypotheses: InterviewHypothesis[];
  created_at: string;
  updated_at: string;
}

export interface InterviewRequirementLink {
  id: string;
  project_id: string;
  interview_id: string;
  requirement_id: string;
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
  /** 备注关联的 PRD */
  prd_id: string | null;
  /** 对 PRD 某段的备注说明 */
  prd_note: string | null;
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

/** Bug 补充 / 评论 */
export interface BugComment {
  id: string;
  project_id: string;
  bug_id: string;
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

/** 强制关闭 / 取消方向（规范标签为「放弃」；「已取消」仍兼容） */
export const REQUIREMENT_CANCELLED_TAG = "放弃";

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
    (t) =>
      t === REQUIREMENT_CANCELLED_TAG ||
      t === "已取消" ||
      t === "取消" ||
      t === "放弃"
  );
}

export function deriveTaskStatusFromTags(tags: string[]): TaskStatus {
  const set = new Set(tags);
  if (set.has(REQUIREMENT_DONE_TAG) || set.has("已完成") || set.has("已做")) return "done";
  if (
    set.has(REQUIREMENT_CANCELLED_TAG) ||
    set.has("已取消") ||
    set.has("取消") ||
    set.has("放弃") ||
    set.has("搁置") ||
    set.has("阻塞")
  ) {
    return "blocked";
  }
  if (set.has("待验收") || set.has("验收")) return "acceptance";
  if (set.has("待测试") || set.has("测试")) return "testing";
  if (set.has("待联调") || set.has("联调")) return "integration";
  if (
    set.has("AI开发中") ||
    set.has("开发中") ||
    set.has("进行中") ||
    set.has("已规划") ||
    set.has("评审")
  ) {
    return "in_progress";
  }
  if (set.has("想法") || set.has("待开始") || set.has("已记录")) return "pending";
  return tags.length ? "in_progress" : "pending";
}

export function statusTagsFromTaskStatus(status: TaskStatus): string[] {
  switch (status) {
    case "done":
      return [REQUIREMENT_DONE_TAG];
    case "acceptance":
      return ["待验收"];
    case "blocked":
      return [REQUIREMENT_CANCELLED_TAG];
    case "integration":
    case "testing":
    case "in_progress":
      return ["AI开发中"];
    case "pending":
    default:
      return ["想法"];
  }
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
