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

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
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

export interface Requirement {
  id: string;
  project_id: string;
  iteration_id: string;
  module_l1_id: string | null;
  module_l2_id: string | null;
  title: string;
  sub_function: string | null;
  detail_work: string | null;
  acceptance_criteria: string | null;
  priority: string | null;
  status: TaskStatus;
  blocker_reason: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

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

export interface Bug {
  id: string;
  project_id: string;
  requirement_id: string | null;
  title: string;
  description: string | null;
  repro_steps: string | null;
  assignee: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
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
