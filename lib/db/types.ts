import type {
  AcceptanceItem,
  AcceptanceRecord,
  ActivityLog,
  Bug,
  BugTestPlan,
  GitActivity,
  Iteration,
  InterviewRequirementLink,
  ModuleNode,
  NotificationItem,
  PoolColumnDef,
  Project,
  ProjectInterview,
  ProjectLearningNote,
  LearningNoteAttachment,
  ProjectPrd,
  PrdReviewComment,
  ProjectMember,
  Prototype,
  Requirement,
  RequirementAttachment,
  BugAttachment,
  BugComment,
  CompetitorEntry,
  ProjectWorkbook,
  ProjectWikiPage,
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
  bug_test_plans: BugTestPlan[];
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
  project_learning_notes: ProjectLearningNote[];
  learning_note_attachments: LearningNoteAttachment[];
  competitor_entries: CompetitorEntry[];
  project_workbooks: ProjectWorkbook[];
  project_wiki_pages: ProjectWikiPage[];
  project_prds: ProjectPrd[];
  prd_review_comments: PrdReviewComment[];
}
