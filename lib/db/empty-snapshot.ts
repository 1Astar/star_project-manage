import type { DatabaseSnapshot } from "@/lib/db/types";

/** 工作台精简读：未加载的表用空数组占位，保持 DatabaseSnapshot 形状 */
export function emptyPmSnapshot(
  partial: Partial<DatabaseSnapshot> = {}
): DatabaseSnapshot {
  return {
    projects: [],
    iterations: [],
    modules: [],
    requirements: [],
    acceptance_items: [],
    role_tasks: [],
    test_records: [],
    acceptance_records: [],
    share_links: [],
    prototypes: [],
    bugs: [],
    notifications: [],
    activity_logs: [],
    comments: [],
    bug_comments: [],
    git_activities: [],
    project_members: [],
    pool_column_defs: [],
    requirement_attachments: [],
    bug_attachments: [],
    requirement_links: [],
    project_interviews: [],
    interview_requirement_links: [],
    ...partial,
  };
}
