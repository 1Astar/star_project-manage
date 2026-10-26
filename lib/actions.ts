"use server";

import { revalidatePath } from "next/cache";
import { assertNotViewerWrite } from "@/lib/auth/require-admin";
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
  listRequirementMigrateTargets,
  migratePoolRequirements,
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
  await assertNotViewerWrite();
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
  await assertNotViewerWrite();
  await updateRequirement(input.requirementId, input.updates, {
    name: "产品",
    role: "admin",
  });
  revalidatePath(`/projects/${input.projectSlug}/requirements/${input.requirementId}`);
  revalidatePath(`/projects/${input.projectSlug}/pool`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  revalidatePath(`/projects/${input.projectSlug}/overview`);
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
  await assertNotViewerWrite();
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

export async function listRequirementMigrateTargetsAction() {
  return listRequirementMigrateTargets();
}

export async function migratePoolRequirementsAction(input: {
  requirementIds: string[];
  targetProjectId: string;
  targetIterationId: string;
  sourceProjectSlug: string;
  targetProjectSlug?: string;
}) {
  const result = await migratePoolRequirements({
    requirementIds: input.requirementIds,
    targetProjectId: input.targetProjectId,
    targetIterationId: input.targetIterationId,
    actor: { name: "产品", role: "admin" },
  });
  revalidatePath(`/projects/${input.sourceProjectSlug}/pool`);
  revalidatePath(`/projects/${input.sourceProjectSlug}/tasks`);
  revalidatePath(`/projects/${input.sourceProjectSlug}/board`);
  revalidatePath(`/projects/${input.sourceProjectSlug}`);
  if (input.targetProjectSlug && input.targetProjectSlug !== input.sourceProjectSlug) {
    revalidatePath(`/projects/${input.targetProjectSlug}/pool`);
    revalidatePath(`/projects/${input.targetProjectSlug}/tasks`);
    revalidatePath(`/projects/${input.targetProjectSlug}/board`);
    revalidatePath(`/projects/${input.targetProjectSlug}`);
  }
  revalidatePath("/boards/requirements");
  return result;
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
  precondition?: string;
  reproSteps?: string;
  expectedResult?: string;
  actualResult?: string;
  suggestion?: string;
  modulePath?: string | null;
  foundVersion?: string | null;
  environments?: string[];
  priority?: import("@/lib/types").Bug["priority"];
  assignee?: string;
  reporterName?: string | null;
  watchers?: string[];
  requirementId?: string | null;
  testPlanId?: string | null;
  iterationId?: string | null;
  severity?: import("@/lib/types").BugSeverity;
  bugType?: import("@/lib/types").BugType;
}) {
  const bug = await createBug({
    project_id: input.projectId,
    requirement_id: input.requirementId,
    test_plan_id: input.testPlanId,
    iteration_id: input.iterationId,
    title: input.title,
    description: input.description,
    precondition: input.precondition,
    repro_steps: input.reproSteps,
    expected_result: input.expectedResult,
    actual_result: input.actualResult,
    suggestion: input.suggestion,
    module_path: input.modulePath,
    found_version: input.foundVersion,
    environments: input.environments,
    priority: input.priority,
    assignee: input.assignee,
    reporter_name: input.reporterName,
    watchers: input.watchers,
    severity: input.severity,
    bug_type: input.bugType,
  });
  revalidatePath(`/projects/${input.projectSlug}/bugs`);
  revalidatePath(`/projects/${input.projectSlug}/bugs/${bug.id}`);
  revalidatePath(`/notifications`);
  return bug;
}

export async function updateBugAction(input: {
  bugId: string;
  projectSlug: string;
  updates: {
    title?: string;
    description?: string | null;
    precondition?: string | null;
    reproSteps?: string | null;
    expectedResult?: string | null;
    actualResult?: string | null;
    suggestion?: string | null;
    modulePath?: string | null;
    foundVersion?: string | null;
    environments?: string[];
    priority?: import("@/lib/types").Bug["priority"];
    assignee?: string | null;
    reporterName?: string | null;
    watchers?: string[];
    requirementId?: string | null;
    testPlanId?: string | null;
    iterationId?: string | null;
    status?: import("@/lib/types").TaskStatus;
    severity?: import("@/lib/types").BugSeverity;
    bugType?: import("@/lib/types").BugType;
    linkedLearningNoteIds?: string[];
    linkedCompetitorIds?: string[];
    createdAt?: string | null;
    updatedAt?: string | null;
  };
}) {
  const { updateBug } = await import("@/lib/db/local-store");
  await updateBug(input.bugId, {
    title: input.updates.title,
    description: input.updates.description,
    precondition: input.updates.precondition,
    repro_steps: input.updates.reproSteps,
    expected_result: input.updates.expectedResult,
    actual_result: input.updates.actualResult,
    suggestion: input.updates.suggestion,
    module_path: input.updates.modulePath,
    found_version: input.updates.foundVersion,
    environments: input.updates.environments,
    priority: input.updates.priority,
    assignee: input.updates.assignee,
    reporter_name: input.updates.reporterName,
    watchers: input.updates.watchers,
    requirement_id: input.updates.requirementId,
    test_plan_id: input.updates.testPlanId,
    iteration_id: input.updates.iterationId,
    status: input.updates.status,
    severity: input.updates.severity,
    bug_type: input.updates.bugType,
    linked_learning_note_ids: input.updates.linkedLearningNoteIds,
    linked_competitor_ids: input.updates.linkedCompetitorIds,
    ...(input.updates.createdAt !== undefined
      ? { created_at: input.updates.createdAt }
      : {}),
    ...(input.updates.updatedAt !== undefined
      ? { updated_at: input.updates.updatedAt }
      : {}),
  });
  revalidatePath(`/projects/${input.projectSlug}/bugs`);
  revalidatePath(`/projects/${input.projectSlug}/bugs/${input.bugId}`);
  revalidatePath(`/projects/${input.projectSlug}/requirements`);
  revalidatePath(`/projects/${input.projectSlug}/overview`);
  revalidatePath(`/projects/${input.projectSlug}`);
  revalidatePath(`/notifications`);
}

export async function addBugCommentAction(input: {
  bugId: string;
  projectSlug: string;
  authorName: string;
  authorRole?: string | null;
  body: string;
}) {
  const { addBugComment } = await import("@/lib/db/local-store");
  const comment = await addBugComment({
    bug_id: input.bugId,
    author_name: input.authorName,
    author_role: input.authorRole,
    body: input.body,
  });
  revalidatePath(`/projects/${input.projectSlug}/bugs/${input.bugId}`);
  return comment;
}

export async function createBugTestPlanAction(input: {
  projectId: string;
  projectSlug: string;
  title: string;
  description?: string | null;
}) {
  const { createBugTestPlan } = await import("@/lib/bugs/test-plans");
  const plan = await createBugTestPlan({
    project_id: input.projectId,
    title: input.title,
    description: input.description,
  });
  revalidatePath(`/projects/${input.projectSlug}/bugs`);
  return plan;
}

export async function updateBugTestPlanAction(input: {
  planId: string;
  projectSlug: string;
  updates: {
    title?: string;
    description?: string | null;
    status?: import("@/lib/types").BugTestPlanStatus;
  };
}) {
  const { updateBugTestPlan } = await import("@/lib/bugs/test-plans");
  const plan = await updateBugTestPlan(input.planId, input.updates);
  revalidatePath(`/projects/${input.projectSlug}/bugs`);
  return plan;
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

export async function createLearningNoteAction(input: {
  projectId: string;
  projectSlug: string;
  title: string;
  kind?: import("@/lib/types").LearningNoteKind;
  parentId?: string | null;
  whyText?: string;
  principle?: string;
  protocol?: string;
  techBackground?: string;
  competitors?: string;
  productThinking?: string;
}) {
  assertNotViewerWrite();
  const { createProjectLearningNote } = await import("@/lib/learning-notes/store");
  const row = await createProjectLearningNote({
    project_id: input.projectId,
    title: input.title,
    kind: input.kind,
    parent_id: input.parentId,
    why_text: input.whyText,
    principle: input.principle,
    protocol: input.protocol,
    tech_background: input.techBackground,
    competitors: input.competitors,
    product_thinking: input.productThinking,
  });
  revalidatePath(`/projects/${input.projectSlug}/learning`);
  return row;
}

export async function updateLearningNoteAction(input: {
  noteId: string;
  projectSlug: string;
  title?: string;
  kind?: import("@/lib/types").LearningNoteKind;
  parentId?: string | null;
  sortOrder?: number;
  whyText?: string;
  principle?: string;
  protocol?: string;
  techBackground?: string;
  competitors?: string;
  productThinking?: string;
  linkedRequirementIds?: string[];
  linkedCompetitorIds?: string[];
  linkedBugIds?: string[];
  suggestions?: import("@/lib/types").LearningSuggestion[];
}) {
  assertNotViewerWrite();
  const { updateProjectLearningNote } = await import("@/lib/learning-notes/store");
  const row = await updateProjectLearningNote(input.noteId, {
    title: input.title,
    kind: input.kind,
    parent_id: input.parentId,
    sort_order: input.sortOrder,
    why_text: input.whyText,
    principle: input.principle,
    protocol: input.protocol,
    tech_background: input.techBackground,
    competitors: input.competitors,
    product_thinking: input.productThinking,
    linked_requirement_ids: input.linkedRequirementIds,
    linked_competitor_ids: input.linkedCompetitorIds,
    linked_bug_ids: input.linkedBugIds,
    suggestions: input.suggestions,
  });
  revalidatePath(`/projects/${input.projectSlug}/learning`);
  revalidatePath(`/projects/${input.projectSlug}/competitors`);
  revalidatePath(`/projects/${input.projectSlug}/bugs`);
  revalidatePath(`/projects/${input.projectSlug}/requirements`);
  revalidatePath(`/projects/${input.projectSlug}/overview`);
  revalidatePath(`/projects/${input.projectSlug}`);
  return row;
}

export async function deleteLearningNoteAction(input: {
  noteId: string;
  projectSlug: string;
}) {
  assertNotViewerWrite();
  const { deleteProjectLearningNote } = await import("@/lib/learning-notes/store");
  await deleteProjectLearningNote(input.noteId);
  revalidatePath(`/projects/${input.projectSlug}/learning`);
}

/** 学习笔记挂上已有需求 */
export async function linkLearningNoteRequirementAction(input: {
  noteId: string;
  projectSlug: string;
  requirementId: string;
}) {
  assertNotViewerWrite();
  const { getLearningNoteById, updateProjectLearningNote } = await import(
    "@/lib/learning-notes/store"
  );
  const note = await getLearningNoteById(input.noteId);
  if (!note) throw new Error("学习笔记不存在");
  const ids = Array.from(
    new Set([...note.linked_requirement_ids, input.requirementId.trim()].filter(Boolean))
  );
  const row = await updateProjectLearningNote(input.noteId, {
    linked_requirement_ids: ids,
  });
  revalidatePath(`/projects/${input.projectSlug}/learning`);
  revalidatePath(`/projects/${input.projectSlug}/requirements`);
  revalidatePath(`/projects/${input.projectSlug}`);
  return row;
}

/** 学习笔记取消关联需求 */
export async function unlinkLearningNoteRequirementAction(input: {
  noteId: string;
  projectSlug: string;
  requirementId: string;
}) {
  assertNotViewerWrite();
  const { getLearningNoteById, updateProjectLearningNote } = await import(
    "@/lib/learning-notes/store"
  );
  const note = await getLearningNoteById(input.noteId);
  if (!note) throw new Error("学习笔记不存在");
  const row = await updateProjectLearningNote(input.noteId, {
    linked_requirement_ids: note.linked_requirement_ids.filter(
      (id) => id !== input.requirementId
    ),
  });
  revalidatePath(`/projects/${input.projectSlug}/learning`);
  revalidatePath(`/projects/${input.projectSlug}/requirements`);
  revalidatePath(`/projects/${input.projectSlug}`);
  return row;
}

/** 新增一条优化建议（不自动建需求） */
export async function addLearningSuggestionAction(input: {
  noteId: string;
  projectSlug: string;
  title: string;
  detail?: string;
}) {
  assertNotViewerWrite();
  const {
    getLearningNoteById,
    updateProjectLearningNote,
    newLearningSuggestion,
  } = await import("@/lib/learning-notes/store");
  const note = await getLearningNoteById(input.noteId);
  if (!note) throw new Error("学习笔记不存在");
  const suggestion = newLearningSuggestion({
    title: input.title,
    detail: input.detail,
  });
  const row = await updateProjectLearningNote(input.noteId, {
    suggestions: [...note.suggestions, suggestion],
  });
  revalidatePath(`/projects/${input.projectSlug}/learning`);
  return { note: row, suggestion };
}

/** 更新 / 删除优化建议 */
export async function updateLearningSuggestionAction(input: {
  noteId: string;
  projectSlug: string;
  suggestionId: string;
  title?: string;
  detail?: string;
  remove?: boolean;
}) {
  assertNotViewerWrite();
  const { getLearningNoteById, updateProjectLearningNote } = await import(
    "@/lib/learning-notes/store"
  );
  const note = await getLearningNoteById(input.noteId);
  if (!note) throw new Error("学习笔记不存在");
  let suggestions = note.suggestions;
  if (input.remove) {
    suggestions = suggestions.filter((s) => s.id !== input.suggestionId);
  } else {
    suggestions = suggestions.map((s) =>
      s.id === input.suggestionId
        ? {
            ...s,
            title: input.title !== undefined ? input.title.trim() || s.title : s.title,
            detail: input.detail !== undefined ? input.detail : s.detail,
          }
        : s
    );
  }
  const row = await updateProjectLearningNote(input.noteId, { suggestions });
  revalidatePath(`/projects/${input.projectSlug}/learning`);
  return row;
}

/**
 * 从优化建议一键生成需求池条目，并回写关联。
 * 若建议已挂过需求则幂等返回，不重复创建。
 */
export async function generateRequirementFromLearningSuggestionAction(input: {
  noteId: string;
  projectId: string;
  projectSlug: string;
  suggestionId: string;
}) {
  assertNotViewerWrite();
  const { getLearningNoteById, updateProjectLearningNote } = await import(
    "@/lib/learning-notes/store"
  );
  const note = await getLearningNoteById(input.noteId);
  if (!note) throw new Error("学习笔记不存在");
  const suggestion = note.suggestions.find((s) => s.id === input.suggestionId);
  if (!suggestion) throw new Error("优化建议不存在");

  if (suggestion.linked_requirement_id) {
    return {
      note,
      requirementId: suggestion.linked_requirement_id,
      created: false,
    };
  }

  const detailParts = [
    suggestion.detail.trim(),
    `来源学习笔记：${note.title}`,
  ].filter(Boolean);

  const { requirement } = await createPoolRequirementAction(
    input.projectSlug,
    input.projectId,
    { title: suggestion.title }
  );

  // 补 detail（createPoolRequirementAction 只接 title；再 patch）
  try {
    const { updatePoolRequirement } = await import("@/lib/db/local-store");
    await updatePoolRequirement(
      requirement.id,
      {
        detail_work: detailParts.join("\n\n"),
        inspiration_source: `学习池 · ${note.title}`,
      },
      { name: "Auto", role: "admin" }
    );
  } catch {
    // 若无 detail 字段更新能力，仍保留已创建的需求
  }

  const suggestions = note.suggestions.map((s) =>
    s.id === suggestion.id
      ? { ...s, linked_requirement_id: requirement.id }
      : s
  );
  const linked = Array.from(
    new Set([...note.linked_requirement_ids, requirement.id])
  );
  const nextNote = await updateProjectLearningNote(input.noteId, {
    suggestions,
    linked_requirement_ids: linked,
  });

  revalidatePath(`/projects/${input.projectSlug}/learning`);
  revalidatePath(`/projects/${input.projectSlug}/pool`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  return {
    note: nextNote,
    requirementId: requirement.id,
    created: true,
  };
}

/**
 * 从 Bug「优化建议」一键生成需求池条目，并回写 Bug.requirement_id。
 * 若 Bug 已挂需求则幂等返回。
 */
export async function generateRequirementFromBugSuggestionAction(input: {
  bugId: string;
  projectId: string;
  projectSlug: string;
}) {
  assertNotViewerWrite();
  const { getBugById, updateBug } = await import("@/lib/db/local-store");
  const detail = await getBugById(input.bugId);
  if (!detail?.bug) throw new Error("Bug 不存在");
  const bug = detail.bug;
  const suggestion = (bug.suggestion ?? "").trim();
  if (!suggestion) throw new Error("请先填写优化建议");

  if (bug.requirement_id) {
    return {
      bug,
      requirementId: bug.requirement_id,
      created: false,
    };
  }

  const { requirement } = await createPoolRequirementAction(
    input.projectSlug,
    input.projectId,
    { title: bug.title }
  );

  try {
    const { updatePoolRequirement } = await import("@/lib/db/local-store");
    await updatePoolRequirement(
      requirement.id,
      {
        detail_work: [
          suggestion,
          `来源 Bug：${bug.title}`,
        ].join("\n\n"),
        inspiration_source: `Bug · ${bug.title}`,
      },
      { name: "Auto", role: "admin" }
    );
  } catch {
    // 保留已创建需求
  }

  await updateBug(input.bugId, { requirement_id: requirement.id });
  const nextDetail = await getBugById(input.bugId);

  revalidatePath(`/projects/${input.projectSlug}/bugs`);
  revalidatePath(`/projects/${input.projectSlug}/bugs/${input.bugId}`);
  revalidatePath(`/projects/${input.projectSlug}/pool`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  return {
    bug: nextDetail?.bug ?? bug,
    requirementId: requirement.id,
    created: true,
  };
}

export async function createPrdAction(input: {
  projectId: string;
  projectSlug: string;
  title: string;
  modulePath?: string | null;
  htmlContent?: string;
}) {
  assertNotViewerWrite();
  const { createProjectPrd } = await import("@/lib/prds/store");
  const row = await createProjectPrd({
    project_id: input.projectId,
    title: input.title,
    module_path: input.modulePath,
    html_content: input.htmlContent,
  });
  revalidatePath(`/projects/${input.projectSlug}/prd`);
  return row;
}

export async function updatePrdAction(input: {
  prdId: string;
  projectSlug: string;
  title?: string;
  modulePath?: string | null;
  htmlContent?: string;
  linkedPrototypes?: Array<{
    prototype_id: string;
    note: string;
    section_hint: string;
  }>;
  /** 整体替换小版本列表（重命名 / 删除快照） */
  versions?: Array<{
    id: string;
    label: string;
    html_content: string;
    created_at: string;
  }>;
  rotateShareToken?: boolean;
  snapshotVersion?: boolean;
  snapshotVersionLabel?: string;
}) {
  assertNotViewerWrite();
  const { updateProjectPrd } = await import("@/lib/prds/store");
  const row = await updateProjectPrd(input.prdId, {
    title: input.title,
    module_path: input.modulePath,
    html_content: input.htmlContent,
    linked_prototypes: input.linkedPrototypes,
    versions: input.versions,
    rotate_share_token: input.rotateShareToken,
    snapshot_version: input.snapshotVersion,
    snapshot_version_label: input.snapshotVersionLabel,
  });
  revalidatePath(`/projects/${input.projectSlug}/prd`);
  return row;
}

export async function deletePrdAction(input: {
  prdId: string;
  projectSlug: string;
}) {
  assertNotViewerWrite();
  const { deleteProjectPrd } = await import("@/lib/prds/store");
  await deleteProjectPrd(input.prdId);
  revalidatePath(`/projects/${input.projectSlug}/prd`);
}

export async function addPrdCommentAction(input: {
  prdId: string;
  projectId: string;
  projectSlug: string;
  body: string;
  author?: string;
  anchorText?: string;
  anchorSelector?: string | null;
}) {
  assertNotViewerWrite();
  const { addPrdComment } = await import("@/lib/prds/store");
  const row = await addPrdComment({
    prd_id: input.prdId,
    project_id: input.projectId,
    body: input.body,
    author: input.author,
    anchor_text: input.anchorText,
    anchor_selector: input.anchorSelector,
  });
  revalidatePath(`/projects/${input.projectSlug}/prd`);
  return row;
}

export async function deletePrdCommentAction(input: {
  commentId: string;
  projectSlug: string;
}) {
  assertNotViewerWrite();
  const { deletePrdComment } = await import("@/lib/prds/store");
  await deletePrdComment(input.commentId);
  revalidatePath(`/projects/${input.projectSlug}/prd`);
}

export async function linkPrototypeToPrdAction(input: {
  prototypeId: string;
  prdId: string | null;
  prdNote?: string | null;
  projectSlug: string;
}) {
  assertNotViewerWrite();
  const { updatePrototypePrdLink } = await import("@/lib/prds/store");
  await updatePrototypePrdLink({
    prototype_id: input.prototypeId,
    prd_id: input.prdId,
    prd_note: input.prdNote,
  });
  revalidatePath(`/projects/${input.projectSlug}/prd`);
  revalidatePath(`/projects/${input.projectSlug}/prototype`);
}

export async function addFeatureModuleFromPrdAction(input: {
  studioProjectId: string;
  projectSlug: string;
  modulePath: string;
}) {
  assertNotViewerWrite();
  const path = input.modulePath.trim();
  if (!path) throw new Error("板块名不能为空");
  const { getProjectById } = await import("@/lib/studio/data");
  const { updateStudioProjectWithModuleSync } = await import(
    "@/lib/studio/mutations"
  );
  const { normalizeFeaturePath, resolveFeatureModules } = await import(
    "@/lib/studio/project-modules"
  );
  const studio = await getProjectById(input.studioProjectId);
  if (!studio) throw new Error("Studio 项目不存在");
  const normalized = normalizeFeaturePath(path);
  const current = resolveFeatureModules(
    studio.id,
    studio.featureModules,
    studio.githubRepo
  );
  if (current.some((m) => normalizeFeaturePath(m) === normalized)) {
    return { featureModules: current, added: false as const };
  }
  const next = [...current, normalized];
  const { project } = await updateStudioProjectWithModuleSync(studio.id, {
    featureModules: next,
  });
  revalidatePath(`/projects/${input.projectSlug}/prd`);
  revalidatePath(`/projects/${input.projectSlug}/overview`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  return {
    featureModules: project.featureModules ?? next,
    added: true as const,
  };
}

export async function createInterviewAction(input: {
  projectId: string;
  projectSlug: string;
  title: string;
  interviewee?: string | null;
  interviewedAt?: string | null;
  recordNotes?: string;
  productJudgment?: string;
  requirementId?: string | null;
}) {
  assertNotViewerWrite();
  const { createProjectInterview } = await import("@/lib/interviews/store");
  const row = await createProjectInterview({
    project_id: input.projectId,
    title: input.title,
    interviewee: input.interviewee,
    interviewed_at: input.interviewedAt,
    record_notes: input.recordNotes,
    product_judgment: input.productJudgment,
    requirement_ids: input.requirementId ? [input.requirementId] : undefined,
  });
  revalidatePath(`/projects/${input.projectSlug}/interviews`);
  revalidatePath(`/projects/${input.projectSlug}/requirements`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  return row;
}

export async function updateInterviewAction(input: {
  interviewId: string;
  projectSlug: string;
  title?: string;
  interviewee?: string | null;
  interviewedAt?: string | null;
  recordNotes?: string;
  productJudgment?: string;
  hypotheses?: import("@/lib/types").InterviewHypothesis[];
}) {
  assertNotViewerWrite();
  const { updateProjectInterview } = await import("@/lib/interviews/store");
  const row = await updateProjectInterview(input.interviewId, {
    title: input.title,
    interviewee: input.interviewee,
    interviewed_at: input.interviewedAt,
    record_notes: input.recordNotes,
    product_judgment: input.productJudgment,
    hypotheses: input.hypotheses,
  });
  revalidatePath(`/projects/${input.projectSlug}/interviews`);
  revalidatePath(`/projects/${input.projectSlug}/requirements`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  return row;
}

export async function deleteInterviewAction(input: {
  interviewId: string;
  projectSlug: string;
}) {
  assertNotViewerWrite();
  const { deleteProjectInterview } = await import("@/lib/interviews/store");
  await deleteProjectInterview(input.interviewId);
  revalidatePath(`/projects/${input.projectSlug}/interviews`);
  revalidatePath(`/projects/${input.projectSlug}/requirements`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
}

export async function linkInterviewRequirementAction(input: {
  projectId: string;
  interviewId: string;
  requirementId: string;
  projectSlug: string;
}) {
  assertNotViewerWrite();
  const { linkInterviewRequirement } = await import("@/lib/interviews/store");
  await linkInterviewRequirement({
    project_id: input.projectId,
    interview_id: input.interviewId,
    requirement_id: input.requirementId,
  });
  revalidatePath(`/projects/${input.projectSlug}/interviews`);
  revalidatePath(`/projects/${input.projectSlug}/requirements`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
}

export async function unlinkInterviewRequirementAction(input: {
  interviewId: string;
  requirementId: string;
  projectSlug: string;
}) {
  assertNotViewerWrite();
  const { unlinkInterviewRequirement } = await import("@/lib/interviews/store");
  await unlinkInterviewRequirement({
    interview_id: input.interviewId,
    requirement_id: input.requirementId,
  });
  revalidatePath(`/projects/${input.projectSlug}/interviews`);
  revalidatePath(`/projects/${input.projectSlug}/requirements`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
}

export async function listInterviewsForRequirementAction(requirementId: string) {
  const { listInterviewsForRequirement } = await import("@/lib/interviews/store");
  return listInterviewsForRequirement(requirementId);
}

export async function listProjectInterviewsAction(projectId: string) {
  const { listProjectInterviews } = await import("@/lib/interviews/store");
  return listProjectInterviews(projectId);
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

/** 将 Studio 项目功能板块增量导入模块树 */
export async function syncFeatureModulesToTreeAction(input: {
  studioProjectId: string;
  projectSlug: string;
}) {
  const { getProjectById } = await import("@/lib/studio/data");
  const { syncFeatureModulesToModuleTree } = await import(
    "@/lib/studio/feature-module-tree"
  );
  const project = await getProjectById(input.studioProjectId);
  if (!project) throw new Error("项目不存在");
  const result = await syncFeatureModulesToModuleTree(
    project,
    project.featureModules ?? []
  );
  revalidatePath(`/projects/${input.projectSlug}/overview`);
  revalidatePath(`/projects/${input.studioProjectId}/overview`);
  revalidatePath(`/projects/${input.projectSlug}/tasks`);
  return result;
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

/** PM 工作台：需求通过 / 打回（打回默认同建 Bug） */
export async function productReviewRequirementAction(input: {
  requirementId: string;
  passed: boolean;
  note?: string;
  /** 打回时是否建 Bug，默认 true */
  createBug?: boolean;
  bugTitle?: string;
  bugSeverity?: import("@/lib/types").BugSeverity;
  bugType?: import("@/lib/types").BugType;
}) {
  await assertNotViewerWrite();
  const { productReviewRequirement, createBug, readDb } = await import(
    "@/lib/db/local-store"
  );
  const { getAdminSession } = await import("@/lib/auth/session");
  const session = await getAdminSession();
  const actor = {
    name: session?.email?.split("@")[0] || "产品",
    role: session?.role === "admin" ? "admin" : "product",
  };
  if (!input.passed && !input.note?.trim()) {
    throw new Error("打回请填写原因 / 补充（会记为 Bug）");
  }
  const result = await productReviewRequirement(
    input.requirementId,
    { passed: input.passed, note: input.note },
    actor
  );

  let bugId: string | null = null;
  if (!input.passed && input.createBug !== false) {
    const db = await readDb();
    const req = db.requirements.find((r) => r.id === input.requirementId);
    if (req) {
      const bug = await createBug({
        project_id: req.project_id,
        requirement_id: req.id,
        title: (input.bugTitle?.trim() || `验收打回：${req.title}`).slice(0, 120),
        description: input.note!.trim(),
        severity: input.bugSeverity ?? 3,
        bug_type: input.bugType ?? "other",
      });
      bugId = bug.id;
    }
  }

  revalidatePath("/");
  revalidatePath("/todos");
  revalidatePath("/boards/requirements");
  return { ok: true as const, requirementId: result.req.id, bugId };
}

/** PM 工作台：整板块批量通过 / 打回 */
export async function productReviewAcceptanceBundleAction(input: {
  items: Array<{
    requirementId?: string;
    changeSessionId?: string;
    pmProjectId?: string;
    title?: string;
  }>;
  passed: boolean;
  note?: string;
  createBug?: boolean;
  bugTitle?: string;
  bugSeverity?: import("@/lib/types").BugSeverity;
  bugType?: import("@/lib/types").BugType;
}) {
  await assertNotViewerWrite();
  if (!input.items.length) throw new Error("没有可验收项");
  if (!input.passed && !input.note?.trim()) {
    throw new Error("打回请填写原因 / 补充（会记为 Bug）");
  }

  const bugIds: string[] = [];
  let firstBug = true;
  for (const item of input.items) {
    if (item.requirementId) {
      const r = await productReviewRequirementAction({
        requirementId: item.requirementId,
        passed: input.passed,
        note: input.note,
        createBug: input.passed ? false : input.createBug !== false && firstBug,
        bugTitle: input.bugTitle,
        bugSeverity: input.bugSeverity,
        bugType: input.bugType,
      });
      if (r.bugId) {
        bugIds.push(r.bugId);
        firstBug = false;
      }
    } else if (item.changeSessionId) {
      const r = await productReviewChangeSessionAction({
        sessionId: item.changeSessionId,
        passed: input.passed,
        note: input.note,
        pmProjectId: item.pmProjectId,
        createBug: input.passed ? false : input.createBug !== false && firstBug,
        bugTitle: input.bugTitle || (item.title ? `验收打回：${item.title}` : undefined),
        bugSeverity: input.bugSeverity,
        bugType: input.bugType,
      });
      if (r.bugId) {
        bugIds.push(r.bugId);
        firstBug = false;
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/todos");
  return { ok: true as const, count: input.items.length, bugIds };
}

/** PM 工作台：变更会话验收（打回默认同建 Bug） */
export async function productReviewChangeSessionAction(input: {
  sessionId: string;
  passed: boolean;
  note?: string;
  pmProjectId?: string;
  createBug?: boolean;
  bugSeverity?: import("@/lib/types").BugSeverity;
  bugType?: import("@/lib/types").BugType;
  bugTitle?: string;
}) {
  await assertNotViewerWrite();
  const { updateChangeSession } = await import("@/lib/studio/mutations");
  const { createBug } = await import("@/lib/db/local-store");
  if (!input.passed && !input.note?.trim()) {
    throw new Error("打回请填写原因 / 补充（会记为 Bug）");
  }
  const session = await updateChangeSession(input.sessionId, {
    humanAcceptance: input.passed ? "passed" : "rejected",
    result: input.note?.trim()
      ? `${input.passed ? "通过" : "打回"}：${input.note.trim()}`
      : input.passed
        ? "产品验收通过"
        : "产品打回",
  });

  let bugId: string | null = null;
  if (!input.passed && input.createBug !== false && input.pmProjectId) {
    const bug = await createBug({
      project_id: input.pmProjectId,
      title: (
        input.bugTitle?.trim() || `验收打回：${session.goal || "变更会话"}`
      ).slice(0, 120),
      description: input.note!.trim(),
      severity: input.bugSeverity ?? 3,
      bug_type: input.bugType ?? "other",
    });
    bugId = bug.id;
  }

  revalidatePath("/");
  revalidatePath("/todos");
  return { ok: true as const, bugId };
}

/** PM 工作台：验收 Side Peek 数据 */
export async function fetchWorkbenchAcceptancePeekAction(input: {
  changeSessionId?: string;
  requirementId?: string;
}) {
  if (input.changeSessionId) {
    const { getChangeSessionById, getProjectById } = await import("@/lib/studio/data");
    const session = await getChangeSessionById(input.changeSessionId);
    if (!session) throw new Error("变更会话不存在");
    const project = await getProjectById(session.projectId);
    return {
      kind: "change_session" as const,
      session,
      projectTitle: project?.title ?? session.projectId,
      href: `/projects/${session.projectId}/evolution`,
    };
  }
  if (input.requirementId) {
    const { readDb } = await import("@/lib/db/local-store");
    const db = await readDb();
    const req = db.requirements.find((r) => r.id === input.requirementId);
    if (!req) throw new Error("需求不存在");
    const project = db.projects.find((p) => p.id === req.project_id);
    const slug = project?.slug || req.project_id;
    return {
      kind: "requirement" as const,
      requirement: {
        id: req.id,
        title: req.title,
        status: req.status,
        status_tags: req.status_tags,
        priority: req.priority,
        detail_work: req.detail_work,
        acceptance_criteria: req.acceptance_criteria,
        next_step: req.next_step,
        completed_at: req.completed_at,
        updated_at: req.updated_at,
      },
      projectTitle: project?.name ?? req.project_id,
      href: `/projects/${slug}/requirements/${req.id}`,
    };
  }
  throw new Error("缺少 changeSessionId 或 requirementId");
}

export async function createCompetitorEntryAction(input: {
  projectId: string;
  projectSlug: string;
  title: string;
  summary?: string;
  url?: string | null;
  modulePath?: string | null;
}) {
  assertNotViewerWrite();
  const { createCompetitorEntry } = await import("@/lib/competitors/store");
  const row = await createCompetitorEntry({
    project_id: input.projectId,
    title: input.title,
    summary: input.summary,
    url: input.url,
    module_path: input.modulePath,
  });
  revalidatePath(`/projects/${input.projectSlug}/competitors`);
  revalidatePath(`/projects/${input.projectSlug}/learning`);
  return row;
}

export async function updateCompetitorEntryAction(input: {
  entryId: string;
  projectSlug: string;
  title?: string;
  summary?: string;
  url?: string | null;
  modulePath?: string | null;
  linkedLearningNoteIds?: string[];
  linkedRequirementIds?: string[];
  linkedBugIds?: string[];
}) {
  assertNotViewerWrite();
  const { updateCompetitorEntry } = await import("@/lib/competitors/store");
  const row = await updateCompetitorEntry(input.entryId, {
    title: input.title,
    summary: input.summary,
    url: input.url,
    module_path: input.modulePath,
    linked_learning_note_ids: input.linkedLearningNoteIds,
    linked_requirement_ids: input.linkedRequirementIds,
    linked_bug_ids: input.linkedBugIds,
  });
  revalidatePath(`/projects/${input.projectSlug}/competitors`);
  revalidatePath(`/projects/${input.projectSlug}/learning`);
  revalidatePath(`/projects/${input.projectSlug}/bugs`);
  revalidatePath(`/projects/${input.projectSlug}/requirements`);
  revalidatePath(`/projects/${input.projectSlug}/overview`);
  revalidatePath(`/projects/${input.projectSlug}`);
  return row;
}

export async function deleteCompetitorEntryAction(input: {
  entryId: string;
  projectSlug: string;
}) {
  assertNotViewerWrite();
  const { deleteCompetitorEntry } = await import("@/lib/competitors/store");
  await deleteCompetitorEntry(input.entryId);
  revalidatePath(`/projects/${input.projectSlug}/competitors`);
}

/** 产品模块主页简介（存 Studio customFields.moduleBiosJson） */
export async function saveProductModuleBioAction(input: {
  studioProjectId: string;
  projectSlug: string;
  moduleName: string;
  bio: string;
}) {
  assertNotViewerWrite();
  const name = input.moduleName.trim();
  if (!name) throw new Error("模块名不能为空");
  const { getProjectById } = await import("@/lib/studio/data");
  const { updateStudioProject } = await import("@/lib/studio/mutations");
  const {
    MODULE_BIOS_FIELD,
    parseModuleBios,
    serializeModuleBios,
    encodeModuleKey,
  } = await import("@/lib/modules/product-module-home");
  const studio = await getProjectById(input.studioProjectId);
  if (!studio) throw new Error("Studio 项目不存在");
  const bios = parseModuleBios(studio.customFields);
  bios[name] = input.bio;
  await updateStudioProject(studio.id, {
    customFields: {
      ...studio.customFields,
      [MODULE_BIOS_FIELD]: serializeModuleBios(bios),
    },
  });
  const key = encodeModuleKey(name);
  revalidatePath(`/projects/${input.projectSlug}/modules`);
  revalidatePath(`/projects/${input.projectSlug}/modules/${key}`);
  revalidatePath(`/projects/${input.studioProjectId}/modules`);
  revalidatePath(`/projects/${input.studioProjectId}/modules/${key}`);
}
