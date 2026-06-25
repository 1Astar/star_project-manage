"use server";

import { revalidatePath } from "next/cache";
import {
  addTestRecord,
  createShareLink,
  getProjectBundle,
  getProjects,
  getShareLinkByToken,
  toggleShareLink,
  updateAcceptanceItem,
  updateRoleTaskWithPermission,
  syncPrototypeAnnotations,
} from "@/lib/db";
import type { PinmarkAnnotationPayload, RoleTask, ShareLink, TaskStatus } from "@/lib/types";
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
