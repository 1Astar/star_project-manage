"use server";

import { revalidatePath } from "next/cache";
import {
  addTestRecord,
  claimShareAssignee,
  createPoolRequirement,
  createPoolColumnDef,
  createProjectMember,
  createShareLink,
  deletePoolColumnDef,
  deletePoolRequirement,
  deleteProjectMember,
  getPoolBundle,
  getProjectBundle,
  getProjects,
  getShareLinkByToken,
  promotePoolRequirement,
  toggleShareLink,
  updateAcceptanceItem,
  updatePoolRequirement,
  updateProjectMember,
  updateProjectPoolTagOptions,
  updateRequirement,
  updateRoleTaskWithPermission,
  syncPrototypeAnnotations,
} from "@/lib/db";
import type {
  PinmarkAnnotationPayload,
  PoolColumnType,
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

export async function savePoolRequirementAction(input: {
  requirementId: string;
  projectSlug: string;
  updates: Partial<{
    title: string | null;
    category: string | null;
    stage_type: string | null;
    priority: string | null;
    status: TaskStatus;
    optimization_notes: string | null;
    known_issues: string | null;
    sub_function: string | null;
    submitted_at: string | null;
    due_date: string | null;
    difficulty_notes: string | null;
    scenario: string | null;
    needs_discussion: boolean;
    prd_link: string | null;
    prototype_link: string | null;
    product_estimate_hours: number | null;
    tags: string[];
    custom_fields?: Record<string, string | number | boolean | null>;
  }>;
}) {
  await updatePoolRequirement(input.requirementId, input.updates, {
    name: "产品",
    role: "admin",
  });
  revalidatePath(`/projects/${input.projectSlug}/pool`);
}

export async function saveRequirementMetaAction(input: {
  requirementId: string;
  projectSlug: string;
  updates: Partial<{
    prd_link: string | null;
    prototype_link: string | null;
    product_estimate_hours: number | null;
    tags: string[];
    custom_fields: Record<string, string | number | boolean | null>;
  }>;
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
}

export async function deletePoolColumnAction(defId: string, projectSlug: string) {
  await deletePoolColumnDef(defId);
  revalidatePath(`/projects/${projectSlug}/pool`);
}

export async function savePoolTagOptionsAction(input: {
  projectId: string;
  projectSlug: string;
  tagOptions: string[];
}) {
  await updateProjectPoolTagOptions(input.projectId, input.tagOptions);
  revalidatePath(`/projects/${input.projectSlug}/pool`);
}

export async function createPoolRequirementAction(projectSlug: string, projectId: string) {
  await createPoolRequirement(projectId, { title: "新功能点" });
  revalidatePath(`/projects/${projectSlug}/pool`);
}

export async function deletePoolRequirementAction(
  requirementId: string,
  projectSlug: string
) {
  await deletePoolRequirement(requirementId);
  revalidatePath(`/projects/${projectSlug}/pool`);
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
  revalidatePath(`/projects/${input.projectSlug}/board`);
  revalidatePath(`/projects/${input.projectSlug}`);
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

export async function saveAcceptanceAction(input: {
  itemId: string;
  passed: boolean;
  note?: string;
  actorName: string;
  projectId: string;
  requirementId: string;
}) {
  const item = await updateAcceptanceItem(
    input.itemId,
    { passed: input.passed, note: input.note ?? null },
    { name: input.actorName, role: "admin" }
  );
  revalidatePath(`/projects/${input.projectId}/requirements/${input.requirementId}`);
  revalidatePath(`/projects/${input.projectId}/board`);
  revalidatePath(`/projects/${input.projectId}/prototype`);
  return item;
}

export async function syncPrototypeAnnotationsAction(input: {
  projectId: string;
  annotations: PinmarkAnnotationPayload[];
  actorName?: string;
}) {
  const synced = await syncPrototypeAnnotations(
    input.projectId,
    input.annotations.map((annotation) => ({
      pinmark_id: annotation.id,
      acceptance_item_id: annotation.starPmAcceptanceItemId ?? null,
      requirement_id: annotation.starPmRequirementId ?? null,
      title: annotation.title ?? null,
      description: annotation.description ?? null,
      annotation_type: annotation.type ?? null,
      shape: annotation.shape ?? null,
      payload: annotation as Record<string, unknown>,
    })),
    { name: input.actorName ?? "产品", role: "admin" }
  );
  revalidatePath(`/projects/${input.projectId}/prototype`);
  return synced;
}

export async function submitTestAction(input: {
  requirementId: string;
  roleTaskId?: string;
  passed: boolean;
  issueDescription?: string;
  testerName: string;
  projectId: string;
}) {
  const record = await addTestRecord({
    requirement_id: input.requirementId,
    role_task_id: input.roleTaskId,
    passed: input.passed,
    issue_description: input.issueDescription,
    tester_name: input.testerName,
  });
  revalidatePath(`/projects/${input.projectId}/board`);
  revalidatePath(`/projects/${input.projectId}/requirements/${input.requirementId}`);
  return record;
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
