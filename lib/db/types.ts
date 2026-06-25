import type {
  AcceptanceItem,
  AcceptanceRecord,
  ActivityLog,
  Bug,
  Iteration,
  ModuleNode,
  NotificationItem,
  Project,
  ProjectMember,
  Prototype,
  PrototypeAnnotation,
  Requirement,
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
  prototype_annotations: PrototypeAnnotation[];
  bugs: Bug[];
  notifications: NotificationItem[];
  activity_logs: ActivityLog[];
  project_members: ProjectMember[];
}
