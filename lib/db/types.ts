import type {
  AcceptanceItem,
  AcceptanceRecord,
  ActivityLog,
  Bug,
  GitActivity,
  Iteration,
  ModuleNode,
  NotificationItem,
  Project,
  Prototype,
  Requirement,
  RequirementComment,
  RoleTask,
  ShareLink,
  TestRecord,
} from "@/lib/types";

export interface DatabaseSnapshot {
  projects: Project[];
  iterations: Iteration[];
  modules: ModuleNode[];
  requirements: Requirement[];
  acceptance_items: AcceptanceItem[];
  role_tasks: RoleTask[];
  test_records: TestRecord[];
  acceptance_records: AcceptanceRecord[];
  share_links: Array<ShareLink & { plain_token?: string }>;
  prototypes: Prototype[];
  bugs: Bug[];
  notifications: NotificationItem[];
  activity_logs: ActivityLog[];
  comments: RequirementComment[];
  git_activities: GitActivity[];
}
