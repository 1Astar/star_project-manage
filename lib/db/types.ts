import type {
  AcceptanceItem,
  AcceptanceRecord,
  ActivityLog,
  Bug,
  GitActivity,
  Iteration,
  InterviewRequirementLink,
  ModuleNode,
  NotificationItem,
  PoolColumnDef,
  Project,
  ProjectInterview,
  ProjectMember,
  Prototype,
  Requirement,
  RequirementAttachment,
  BugAttachment,
  BugComment,
  RequirementComment,
  RequirementLink,
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
  bug_comments: BugComment[];
  git_activities: GitActivity[];
  project_members: ProjectMember[];
  pool_column_defs: PoolColumnDef[];
  requirement_attachments: RequirementAttachment[];
  bug_attachments: BugAttachment[];
  requirement_links: RequirementLink[];
  project_interviews: ProjectInterview[];
  interview_requirement_links: InterviewRequirementLink[];
}
