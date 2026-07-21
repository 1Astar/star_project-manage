"use server";

import { revalidatePath } from "next/cache";
import {
  addRequirementComment,
  addTestRecordWithPermission,
  claimShareAssignee,
  createPoolColumnDef,
  createPoolRequirement,
  createPlanningIteration,
  createProjectModule,
  createRequirementLink,
  createBug,
  createProjectMember,
  createShareLink,
  deletePoolColumnDef,
  deletePoolRequirement,
  deletePoolRequirements,
  deleteProjectModule,
  dedupePoolRequirements,
  deleteProjectMember,
  deleteRequirementLink,
  getPoolBundle,
  getProjectBundle,
  getProjects,
  getShareLinkByToken,
  listBugsByProject,
  listProjectModules,
  promotePoolRequirement,
  syncStudioIdeasIntoPool,
  toggleShareLink,
  updateAcceptanceItem,
  updateAcceptanceItemWithPermission,
  updateBugStatus,
  updatePlanningIteration,
  updatePoolRequirement,
  updateProjectGitSettings,
  updateProjectMember,
  updateProjectModule,
  updateProjectPoolTagOptions,
  updateRequirement,
  updateRoleTaskWithPermission,
} from "@/lib/db/local-store";
import type {
  LinkEntityType,
  LinkRelationType,
  PoolColumnType,
  RequirementUpdates,
  RoleTask,
  RoleType,
  ShareLink,
  TaskStatus,
} from "@/lib/types";
import { calcProjectStats } from "@/lib/utils";

export async function fetchDashboardData() {
  const projects = await getProjects();
  const summaries = await Promise.all(
    projects.map(async (project) => {
      const bundle = await getProjectBundle(project.id);
      if (!bundle) return null;
      const stats = calcProjectStats(bundle.role_tasks);
      return {
        project,
        stats,
        requirementCount: bundle.requirements.length,
        pendingAcceptance: bundle.acceptance_items.filter((a) => a.passed === null).length,
      };
    })
  );
  return summaries.filter(Boolean);
}

export async function fetchProjectBoard(projectId: string) {
  return getProjectBundle(projectId);
}

export async function fetchPoolData(projectId: string) {
  return getPoolBundle(projectId);
}

/** 拉取需求池前，把该项目 Studio 灵感 + 演进同步进需求（去重） */
export async function fetchPoolDataWithIdeaSync(
  projectId: string,
  ideas: Array<{
    id: string;
    title: string;
    oneLineIdea?: string;
    whyItMatters?: string;
    triggerSource?: string;
    sourceChat?: string;
    chatTopic?: string;
    suggestedNextStep?: string;
    priority?: string;
    occurredAt?: string;
    completedAt?: string | null;
    status?: string;
  }>,
  evolutions: Array<{
    id: string;
    title: string;
    before?: string;
    after?: string;
    reason?: string;
    decision?: string;
    createdAt?: string;
  }> = [],
  options?: { actorNote?: string }
) {
  const sync = await syncStudioIdeasIntoPool(projectId, ideas, evolutions, options);
  const bundle = await getPoolBundle(projectId);
  return { bundle, sync };
}

export async function savePoolRequirementAction(input: {
  requirementId: string;
  projectSlug: string;
  updates: RequirementUpdates;
}) {
  await updatePoolRequirement(input.requirementId, input.updates, {
    name: "产品",
    role: "admin",
  });
  revalidatePath(`/projects/${input.projectSlug}/pool`);
}

export async function saveRequirementDetailAction(input: {
  requirementId: string;
  projectSlug: string;
  updates: RequirementUpdates;
}) {
  await updateRequirement(input.requirementId, input.updates, {
    name: "产品",
    role: "admin",
  });
  revalidatePath(`/projects/${input.projectSlug}/requirements/${input.requirementId}`);
  revalidatePath(`/projects/${input.projectSlug}/pool`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  revalidatePath(`/projects/${input.projectSlug}`);
}

export async function saveRequirementMetaAction(input: {
  requirementId: string;
  projectSlug: string;
  updates: Pick<
    RequirementUpdates,
    "prd_link" | "prototype_link" | "product_estimate_hours" | "tags" | "custom_fields"
  >;
}) {
  await updateRequirement(input.requirementId, input.updates, {
    name: "产品",
    role: "admin",
  });
  revalidatePath(`/projects/${input.projectSlug}/requirements/${input.requirementId}`);
  revalidatePath(`/projects/${input.projectSlug}/pool`);
  revalidatePath(`/projects/${input.projectSlug}/board`);
}

export async function createPoolColumnAction(input: {
  projectId: string;
  projectSlug: string;
  label: string;
  columnType: PoolColumnType;
  options?: string[];
}) {
  await createPoolColumnDef({
    project_id: input.projectId,
    label: input.label,
    column_type: input.columnType,
    options: input.options,
  });
  revalidatePath(`/projects/${input.projectSlug}/pool`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
}

export async function deletePoolColumnAction(defId: string, projectSlug: string) {
  await deletePoolColumnDef(defId);
  revalidatePath(`/projects/${projectSlug}/pool`);
  revalidatePath(`/projects/${projectSlug}/tasks`);
}

export async function savePoolTagOptionsAction(input: {
  projectId: string;
  projectSlug: string;
  tagOptions: string[];
}) {
  await updateProjectPoolTagOptions(input.projectId, input.tagOptions);
  revalidatePath(`/projects/${input.projectSlug}/pool`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
}

export async function createPoolRequirementAction(
  projectSlug: string,
  projectId: string,
  opts?: { parentId?: string | null; title?: string }
) {
  const req = await createPoolRequirement(projectId, {
    title: opts?.title ?? "新功能点",
    parent_id: opts?.parentId ?? null,
  });
  revalidatePath(`/projects/${projectSlug}/pool`);
  revalidatePath(`/projects/${projectSlug}/tasks`);
  return { id: req.id, requirement: req };
}

export async function createRequirementLinkAction(input: {
  projectId: string;
  projectSlug: string;
  sourceType: LinkEntityType;
  sourceId: string;
  targetType: LinkEntityType;
  targetId: string;
  relationType: LinkRelationType;
}) {
  const link = await createRequirementLink({
    project_id: input.projectId,
    source_type: input.sourceType,
    source_id: input.sourceId,
    target_type: input.targetType,
    target_id: input.targetId,
    relation_type: input.relationType,
  });
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  return link;
}

export async function deleteRequirementLinkAction(
  linkId: string,
  projectSlug: string
) {
  await deleteRequirementLink(linkId);
  revalidatePath(`/projects/${projectSlug}/tasks`);
}

export async function forceCloseRequirementAction(input: {
  requirementId: string;
  projectSlug: string;
}) {
  await updateRequirement(
    input.requirementId,
    { force_closed: true },
    { name: "产品", role: "admin" }
  );
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
}

export async function deletePoolRequirementAction(
  requirementId: string,
  projectSlug: string
) {
  await deletePoolRequirement(requirementId);
  revalidatePath(`/projects/${projectSlug}/pool`);
  revalidatePath(`/projects/${projectSlug}/tasks`);
}

export async function deletePoolRequirementsAction(
  requirementIds: string[],
  projectSlug: string
) {
  const n = await deletePoolRequirements(requirementIds);
  revalidatePath(`/projects/${projectSlug}/pool`);
  revalidatePath(`/projects/${projectSlug}/tasks`);
  return { deleted: n };
}

export async function dedupePoolRequirementsAction(
  projectId: string,
  projectSlug: string
) {
  const n = await dedupePoolRequirements(projectId);
  revalidatePath(`/projects/${projectSlug}/pool`);
  revalidatePath(`/projects/${projectSlug}/tasks`);
  return { deleted: n };
}

export async function promotePoolRequirementAction(input: {
  requirementId: string;
  iterationId: string;
  projectSlug: string;
}) {
  await promotePoolRequirement(input.requirementId, input.iterationId, {
    name: "产品",
    role: "admin",
  });
  revalidatePath(`/projects/${input.projectSlug}/pool`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  revalidatePath(`/projects/${input.projectSlug}/board`);
  revalidatePath(`/projects/${input.projectSlug}`);
}

export async function createPlanningIterationAction(input: {
  projectId: string;
  projectSlug: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  release_tag?: string | null;
}) {
  const iteration = await createPlanningIteration(input);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  revalidatePath(`/projects/${input.projectSlug}`);
  return iteration;
}

export async function updatePlanningIterationAction(input: {
  iterationId: string;
  projectSlug: string;
  updates: Partial<{
    name: string;
    start_date: string | null;
    end_date: string | null;
    release_tag: string | null;
  }>;
}) {
  const iteration = await updatePlanningIteration(input.iterationId, input.updates);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  revalidatePath(`/projects/${input.projectSlug}`);
  return iteration;
}

export async function createBugAction(input: {
  projectId: string;
  projectSlug: string;
  title: string;
  description?: string;
  reproSteps?: string;
  assignee?: string;
  requirementId?: string | null;
  severity?: import("@/lib/types").BugSeverity;
  bugType?: import("@/lib/types").BugType;
}) {
  const bug = await createBug({
    project_id: input.projectId,
    requirement_id: input.requirementId,
    title: input.title,
    description: input.description,
    repro_steps: input.reproSteps,
    assignee: input.assignee,
    severity: input.severity,
    bug_type: input.bugType,
  });
  revalidatePath(`/projects/${input.projectSlug}/bugs`);
  revalidatePath(`/projects/${input.projectSlug}/bugs/${bug.id}`);
  return bug;
}

export async function updateBugAction(input: {
  bugId: string;
  projectSlug: string;
  updates: {
    title?: string;
    description?: string | null;
    reproSteps?: string | null;
    assignee?: string | null;
    requirementId?: string | null;
    status?: import("@/lib/types").TaskStatus;
    severity?: import("@/lib/types").BugSeverity;
    bugType?: import("@/lib/types").BugType;
  };
}) {
  const { updateBug } = await import("@/lib/db/local-store");
  await updateBug(input.bugId, {
    title: input.updates.title,
    description: input.updates.description,
    repro_steps: input.updates.reproSteps,
    assignee: input.updates.assignee,
    requirement_id: input.updates.requirementId,
    status: input.updates.status,
    severity: input.updates.severity,
    bug_type: input.updates.bugType,
  });
  revalidatePath(`/projects/${input.projectSlug}/bugs`);
  revalidatePath(`/projects/${input.projectSlug}/bugs/${input.bugId}`);
}

export async function updateBugStatusAction(input: {
  bugId: string;
  projectSlug: string;
  status: TaskStatus;
}) {
  await updateBugStatus(input.bugId, input.status);
  revalidatePath(`/projects/${input.projectSlug}/bugs`);
  revalidatePath(`/projects/${input.projectSlug}/bugs/${input.bugId}`);
}

export async function fetchProjectBugs(projectId: string) {
  return listBugsByProject(projectId);
}

export async function fetchBugDetail(bugId: string) {
  const { getBugById } = await import("@/lib/db/local-store");
  return getBugById(bugId);
}

export async function createMemberAction(input: {
  projectId: string;
  projectSlug: string;
  name: string;
  role?: RoleType | null;
}) {
  await createProjectMember({
    project_id: input.projectId,
    name: input.name,
    role: input.role,
  });
  revalidatePath(`/projects/${input.projectSlug}/settings`);
}

export async function toggleMemberAction(input: {
  memberId: string;
  isActive: boolean;
  projectSlug: string;
}) {
  await updateProjectMember(input.memberId, { is_active: input.isActive });
  revalidatePath(`/projects/${input.projectSlug}/settings`);
}

export async function deleteMemberAction(input: {
  memberId: string;
  projectSlug: string;
  clearAssignees?: boolean;
}) {
  await deleteProjectMember(input.memberId, input.clearAssignees ?? false);
  revalidatePath(`/projects/${input.projectSlug}/settings`);
}

export async function claimShareIdentityAction(input: {
  shareToken: string;
  displayName: string;
}) {
  return claimShareAssignee(input.shareToken, input.displayName);
}

export async function saveRequirementNoteAction(input: {
  requirementId: string;
  note: string;
  projectId: string;
  projectSlug: string;
}) {
  const bundle = await getProjectBundle(input.projectId);
  const acceptanceItem = bundle?.acceptance_items.find(
    (a) => a.requirement_id === input.requirementId
  );
  if (acceptanceItem) {
    await updateAcceptanceItem(
      acceptanceItem.id,
      { note: input.note || null },
      { name: "产品", role: "admin" }
    );
  } else {
    await updateRequirement(
      input.requirementId,
      { detail_work: input.note || null },
      { name: "产品", role: "admin" }
    );
  }
  revalidatePath(`/projects/${input.projectSlug}/prototype`);
  revalidatePath(`/projects/${input.projectSlug}/requirements/${input.requirementId}`);
}

export async function saveRoleTaskAction(input: {
  taskId: string;
  updates: Partial<RoleTask>;
  actorName: string;
  actorRole?: string;
  projectId: string;
  shareToken?: string;
}) {
  const task = await updateRoleTaskWithPermission(
    input.taskId,
    input.updates,
    { name: input.actorName, role: input.actorRole },
    input.shareToken
  );
  revalidatePath(`/projects/${input.projectId}/board`);
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath(`/share`);
  return task;
}

export async function saveAcceptanceAction(input: {
  itemId: string;
  passed: boolean;
  note?: string;
  actorName: string;
  actorRole?: string;
  projectId: string;
  requirementId: string;
  shareToken?: string;
}) {
  const item = await updateAcceptanceItemWithPermission(
    input.itemId,
    { passed: input.passed, note: input.note ?? null },
    { name: input.actorName, role: input.actorRole ?? "admin" },
    input.shareToken
  );
  revalidatePath(`/projects/${input.projectId}/requirements/${input.requirementId}`);
  revalidatePath(`/projects/${input.projectId}/board`);
  revalidatePath(`/share`);
  return item;
}

export async function submitTestAction(input: {
  requirementId: string;
  roleTaskId?: string;
  passed: boolean;
  issueDescription?: string;
  testerName: string;
  projectId: string;
  shareToken?: string;
}) {
  const record = await addTestRecordWithPermission(
    {
      requirement_id: input.requirementId,
      role_task_id: input.roleTaskId,
      passed: input.passed,
      issue_description: input.issueDescription,
      tester_name: input.testerName,
    },
    input.shareToken
  );
  revalidatePath(`/projects/${input.projectId}/board`);
  revalidatePath(`/projects/${input.projectId}/requirements/${input.requirementId}`);
  revalidatePath(`/share`);
  return record;
}

export async function addCommentAction(input: {
  projectId: string;
  requirementId: string;
  body: string;
  authorName: string;
  authorRole?: string;
  shareToken?: string;
}) {
  const comment = await addRequirementComment({
    project_id: input.projectId,
    requirement_id: input.requirementId,
    author_name: input.authorName,
    author_role: input.authorRole ?? null,
    body: input.body,
    shareToken: input.shareToken,
  });
  revalidatePath(`/projects/${input.projectId}/requirements/${input.requirementId}`);
  revalidatePath(`/share`);
  return comment;
}

export async function createShareLinkAction(
  projectId: string,
  role: ShareLink["role"],
  label: string
) {
  const link = await createShareLink(projectId, role, label);
  revalidatePath(`/projects/${projectId}/settings`);
  return link;
}

export async function toggleShareLinkAction(linkId: string, isActive: boolean, projectId: string) {
  const link = await toggleShareLink(linkId, isActive);
  revalidatePath(`/projects/${projectId}/settings`);
  return link;
}

export async function saveProjectGitSettingsAction(input: {
  projectId: string;
  repo_full_name?: string | null;
  repo_branch?: string | null;
  repo_url?: string | null;
  demo_url?: string | null;
  local_run_guide?: string | null;
  code_path?: string | null;
  vercel_project_id?: string | null;
  vercel_deployment_url?: string | null;
}) {
  const project = await updateProjectGitSettings(input.projectId, input);
  revalidatePath(`/projects/${project.slug}`);
  revalidatePath(`/projects/${project.slug}/settings`);
  return project;
}

export async function validateShareToken(token: string) {
  return getShareLinkByToken(token);
}

export async function updateTaskStatusAction(input: {
  taskId: string;
  status: TaskStatus;
  actorName: string;
  actorRole?: string;
  projectId: string;
  blockerReason?: string;
  shareToken?: string;
}) {
  return saveRoleTaskAction({
    taskId: input.taskId,
    updates: {
      status: input.status,
      blocker_reason: input.blockerReason ?? null,
    },
    actorName: input.actorName,
    actorRole: input.actorRole,
    projectId: input.projectId,
    shareToken: input.shareToken,
  });
}

export async function fetchProjectModules(projectId: string) {
  return listProjectModules(projectId);
}

export async function createProjectModuleAction(input: {
  projectId: string;
  projectSlug: string;
  name: string;
  parentId?: string | null;
}) {
  const mod = await createProjectModule({
    projectId: input.projectId,
    name: input.name,
    parentId: input.parentId,
  });
  revalidatePath(`/projects/${input.projectSlug}/overview`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  return mod;
}

export async function updateProjectModuleAction(input: {
  projectSlug: string;
  moduleId: string;
  name: string;
}) {
  const mod = await updateProjectModule({
    moduleId: input.moduleId,
    name: input.name,
  });
  revalidatePath(`/projects/${input.projectSlug}/overview`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  return mod;
}

export async function deleteProjectModuleAction(input: {
  projectSlug: string;
  moduleId: string;
}) {
  await deleteProjectModule(input.moduleId);
  revalidatePath(`/projects/${input.projectSlug}/overview`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
}
