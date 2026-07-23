import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  assetToRow,
  columnDefToRow,
  evolutionToRow,
  ideaToRow,
  projectToRow,
  releaseToRow,
  taskToRow,
} from "@/lib/studio/mappers";
import {
  applyMemoryMutation,
  ensureStudioReady,
  getStudioSnapshot,
  invalidateStudioCache,
} from "@/lib/studio/store";
import {
  assertNoDuplicateAsset,
  assertNoDuplicateProject,
} from "@/lib/studio/entity-dedupe";
import type {
  Asset,
  AssetType,
  EmotionLevel,
  EvolutionLog,
  EvolutionLogType,
  Idea,
  IdeaPriority,
  IdeaStatus,
  IdeaSubtask,
  IdeaType,
  Project,
  ProjectBody,
  ProjectPriority,
  ProjectStatus,
  StudioCustomFieldValue,
  StudioProjectColumnDef,
  StudioProjectColumnType,
  StudioRelease,
  StudioTask,
  TaskPriority,
  TaskStatus,
} from "@/lib/studio/types";

function studioId(prefix: string) {
  return `${prefix}${crypto.randomUUID().slice(0, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

/** 仅一层父子：父必须存在且自身无父；不可自挂；有子时不可再挂父 */
function assertValidParent(
  projects: Project[],
  parentId: string | null,
  selfId: string | null
) {
  if (!parentId) return;
  if (selfId && parentId === selfId) throw new Error("不能将项目设为自己的父项目");
  const parent = projects.find((p) => p.id === parentId);
  if (!parent) throw new Error("父项目不存在");
  if (parent.parentId) throw new Error("仅支持一层父子，不能挂到子项目下");
  if (selfId && projects.some((p) => p.parentId === selfId)) {
    throw new Error("该项目已有子项目，不能再挂到其他父项目下");
  }
}

function sb() {
  const client = createServiceClient();
  if (!client) throw new Error("Supabase 未配置");
  return client;
}

async function writeSupabase<T>(write: () => Promise<T>, memoryWrite: () => T): Promise<T> {
  if (isSupabaseConfigured()) {
    await ensureStudioReady();
    const result = await write();
    invalidateStudioCache();
    return result;
  }
  return memoryWrite();
}

const EMPTY_BODY: ProjectBody = {
  initialThought: "",
  whyThought: "",
  positioning: "",
  iterations: "",
  done: "",
  notDone: "",
  nextStep: "",
  links: "",
  retrospectives: "",
};

export type CreateProjectInput = {
  title: string;
  positioning?: string;
  targetUser?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  currentStage?: string;
  nextAction?: string;
  demoUrl?: string | null;
  localRunGuide?: string | null;
  codePath?: string | null;
  githubRepo?: string | null;
  githubBranch?: string;
  vercelUrl?: string | null;
  relatedPageUrl?: string | null;
  portfolioValue?: string;
  customFields?: Record<string, StudioCustomFieldValue>;
  body?: Partial<ProjectBody>;
  /** 父项目 id；仅一层 */
  parentId?: string | null;
  /** 功能板块名单；空则运行时用默认 */
  featureModules?: string[];
  /** true=跳过标题查重强制新建 */
  force?: boolean;
};

export type CreateProjectColumnInput = {
  label: string;
  columnType?: StudioProjectColumnType;
  options?: string[];
};

export type UpdateProjectInput = Partial<CreateProjectInput>;

export type CreateIdeaInput = {
  title: string;
  oneLineIdea?: string;
  whyItMatters?: string;
  aiSupplement?: string;
  chatTopic?: string;
  triggerSource?: string;
  sourceChat?: string;
  sourceMethod?: string;
  emotionLevel?: EmotionLevel;
  type?: IdeaType;
  priority?: IdeaPriority;
  rawInput?: string;
  relatedProjectId?: string | null;
  relatedIdeaId?: string | null;
  relatedModule?: string;
  subtasks?: IdeaSubtask[];
  status?: IdeaStatus;
  suggestedNextStep?: string;
  decisionNotes?: string;
  evolutionNotes?: string;
  relatedAssetsNote?: string;
  githubIssueNumber?: number | null;
  githubIssueUrl?: string | null;
  githubLabels?: string[];
  occurredAt?: string | null;
  completedAt?: string | null;
  syncSubtasksToProject?: boolean;
};

export type UpdateIdeaInput = Partial<CreateIdeaInput>;

export type CreateEvolutionInput = {
  title: string;
  projectId: string;
  logType: EvolutionLogType;
  before?: string;
  after?: string;
  reason?: string;
  decision?: string;
  /** 功能板块 */
  module?: string;
  /** 挂到某个 Release/Tag */
  releaseTag?: string | null;
};

export type UpdateEvolutionInput = Partial<Omit<CreateEvolutionInput, "projectId">> & {
  projectId?: string;
};

export type CreateTaskInput = {
  title: string;
  projectId: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  workload?: string;
  blocker?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dueDate?: string | null;
  estimateHours?: number | null;
  actualHours?: number | null;
  completedAt?: string | null;
  progressNote?: string;
  completionSource?: StudioTask["completionSource"];
  gitCommitSha?: string | null;
  gitCommitMessage?: string | null;
  sourceIdeaId?: string | null;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

export type CreateAssetInput = {
  title: string;
  projectId: string;
  assetType?: AssetType;
  url?: string;
  storagePath?: string | null;
  mimeType?: string | null;
  note?: string;
  takeaway?: string;
  risk?: string | null;
  /** true=跳过标题/URL 查重强制新建 */
  force?: boolean;
};

export type UpdateAssetInput = Partial<CreateAssetInput>;

async function demoteOtherMainline(exceptId: string) {
  if (!isSupabaseConfigured()) {
    applyMemoryMutation((snap) => {
      for (const p of snap.projects) {
        if (p.id !== exceptId && p.status === "mainline") {
          p.status = "active";
          p.updatedAt = nowIso();
        }
      }
    });
    return;
  }

  const { error } = await sb()
    .from("studio_projects")
    .update({ status: "active", updated_at: nowIso() })
    .eq("status", "mainline")
    .neq("id", exceptId);
  if (error) throw new Error(error.message);
}

function buildProject(input: CreateProjectInput, existing?: Project): Project {
  const now = nowIso();
  return {
    id: existing?.id ?? studioId("proj-"),
    title: input.title,
    positioning: input.positioning ?? existing?.positioning ?? "",
    targetUser: input.targetUser ?? existing?.targetUser ?? "",
    status: input.status ?? existing?.status ?? "active",
    priority: input.priority ?? existing?.priority ?? "P2",
    currentStage: input.currentStage ?? existing?.currentStage ?? "",
    nextAction: input.nextAction ?? existing?.nextAction ?? "",
    demoUrl: input.demoUrl !== undefined ? input.demoUrl : (existing?.demoUrl ?? null),
    localRunGuide:
      input.localRunGuide !== undefined ? input.localRunGuide : (existing?.localRunGuide ?? null),
    codePath: input.codePath !== undefined ? input.codePath : (existing?.codePath ?? null),
    githubRepo: input.githubRepo !== undefined ? input.githubRepo : (existing?.githubRepo ?? null),
    githubBranch: input.githubBranch ?? existing?.githubBranch ?? "",
    vercelUrl: input.vercelUrl !== undefined ? input.vercelUrl : (existing?.vercelUrl ?? null),
    lastCommitSha: existing?.lastCommitSha ?? null,
    lastCommitMessage: existing?.lastCommitMessage ?? null,
    lastCommitAt: existing?.lastCommitAt ?? null,
    lastGitSyncedAt: existing?.lastGitSyncedAt ?? null,
    relatedPageUrl:
      input.relatedPageUrl !== undefined ? input.relatedPageUrl : (existing?.relatedPageUrl ?? null),
    portfolioValue: input.portfolioValue ?? existing?.portfolioValue ?? "",
    customFields: {
      ...(existing?.customFields ?? {}),
      ...(input.customFields ?? {}),
    },
    body: {
      ...EMPTY_BODY,
      ...(existing?.body ?? {}),
      ...(input.body ?? {}),
    },
    parentId:
      input.parentId !== undefined ? input.parentId : (existing?.parentId ?? null),
    featureModules:
      input.featureModules !== undefined
        ? input.featureModules.map((m) => m.trim()).filter(Boolean)
        : (existing?.featureModules ?? []),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function slugColumnKey(label: string, existingKeys: Set<string>) {
  const base =
    label
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_\u4e00-\u9fa5]/g, "")
      .slice(0, 32) || `col_${studioId("").slice(0, 6)}`;
  let key = base;
  let suffix = 1;
  while (existingKeys.has(key)) {
    key = `${base}_${suffix++}`;
  }
  return key;
}

export async function listStudioProjectColumns(activeOnly = true): Promise<StudioProjectColumnDef[]> {
  const { projectColumnDefs } = await getStudioSnapshot();
  const list = [...(projectColumnDefs ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  return activeOnly ? list.filter((d) => d.isActive) : list;
}

export async function createStudioProjectColumn(
  input: CreateProjectColumnInput
): Promise<StudioProjectColumnDef> {
  const label = input.label?.trim();
  if (!label) throw new Error("列名必填");
  const columnType = input.columnType ?? "text";
  const options = (input.options ?? []).map((s) => s.trim()).filter(Boolean);
  if (columnType === "select" && options.length === 0) {
    throw new Error("单选列至少需要一个选项");
  }

  const snapshot = await getStudioSnapshot();
  const existingKeys = new Set((snapshot.projectColumnDefs ?? []).map((d) => d.key));
  const def: StudioProjectColumnDef = {
    id: studioId("pcol-"),
    key: slugColumnKey(label, existingKeys),
    label,
    columnType,
    options,
    sortOrder: (snapshot.projectColumnDefs ?? []).length + 1,
    isActive: true,
    createdAt: nowIso(),
  };

  return writeSupabase(
    async () => {
      const { error } = await sb().from("studio_project_column_defs").insert(columnDefToRow(def));
      if (error) throw new Error(error.message);
      return def;
    },
    () => {
      applyMemoryMutation((snap) => {
        if (!snap.projectColumnDefs) snap.projectColumnDefs = [];
        snap.projectColumnDefs.push(def);
      });
      return def;
    }
  );
}

export async function deleteStudioProjectColumn(id: string): Promise<void> {
  const snapshot = await getStudioSnapshot();
  const existing = (snapshot.projectColumnDefs ?? []).find((d) => d.id === id);
  if (!existing) throw new Error("自定义列不存在");

  const next = { ...existing, isActive: false };

  await writeSupabase(
    async () => {
      const { error } = await sb()
        .from("studio_project_column_defs")
        .upsert(columnDefToRow(next), { onConflict: "id" });
      if (error) throw new Error(error.message);
    },
    () => {
      applyMemoryMutation((snap) => {
        const idx = (snap.projectColumnDefs ?? []).findIndex((d) => d.id === id);
        if (idx >= 0) snap.projectColumnDefs[idx] = next;
      });
    }
  );
}

export async function createStudioProject(input: CreateProjectInput): Promise<Project> {
  if (!input.title?.trim()) throw new Error("title 必填");

  const snapshot = await getStudioSnapshot();
  assertNoDuplicateProject(snapshot.projects, input.title.trim(), input.force);
  assertValidParent(snapshot.projects, input.parentId ?? null, null);

  const project = buildProject(input);

  return writeSupabase(
    async () => {
      if (project.status === "mainline") await demoteOtherMainline(project.id);
      const { error } = await sb().from("studio_projects").insert(projectToRow(project));
      if (error) throw new Error(error.message);
      return project;
    },
    () => {
      if (project.status === "mainline") {
        applyMemoryMutation((snap) => {
          for (const p of snap.projects) {
            if (p.status === "mainline") {
              p.status = "active";
              p.updatedAt = nowIso();
            }
          }
        });
      }
      applyMemoryMutation((snap) => {
        snap.projects.unshift(project);
      });
      return project;
    }
  );
}

export async function updateStudioProject(id: string, patch: UpdateProjectInput): Promise<Project> {
  const snapshot = await getStudioSnapshot();
  const existing = snapshot.projects.find((p) => p.id === id);
  if (!existing) throw new Error("项目不存在");

  const nextParent =
    patch.parentId !== undefined ? patch.parentId : existing.parentId;
  assertValidParent(snapshot.projects, nextParent ?? null, id);

  const project = buildProject({ ...patch, title: patch.title ?? existing.title }, existing);

  return writeSupabase(
    async () => {
      if (project.status === "mainline") await demoteOtherMainline(project.id);
      const { error } = await sb().from("studio_projects").upsert(projectToRow(project), { onConflict: "id" });
      if (error) throw new Error(error.message);
      return project;
    },
    () => {
      if (project.status === "mainline") {
        applyMemoryMutation((snap) => {
          for (const p of snap.projects) {
            if (p.id !== project.id && p.status === "mainline") {
              p.status = "active";
              p.updatedAt = nowIso();
            }
          }
        });
      }
      applyMemoryMutation((snap) => {
        const idx = snap.projects.findIndex((p) => p.id === id);
        if (idx >= 0) snap.projects[idx] = project;
      });
      return project;
    }
  );
}

/** 更新项目；若写入 featureModules 则增量同步到模块树 */
export async function updateStudioProjectWithModuleSync(
  id: string,
  patch: UpdateProjectInput
): Promise<{
  project: Project;
  moduleTreeSync: import("@/lib/studio/feature-module-tree").ModuleTreeSyncResult | null;
}> {
  const project = await updateStudioProject(id, patch);
  if (patch.featureModules === undefined) {
    return { project, moduleTreeSync: null };
  }
  try {
    const { syncFeatureModulesToModuleTree } = await import(
      "@/lib/studio/feature-module-tree"
    );
    const moduleTreeSync = await syncFeatureModulesToModuleTree(
      project,
      project.featureModules ?? []
    );
    return { project, moduleTreeSync };
  } catch (err) {
    console.error("[updateStudioProjectWithModuleSync] module tree sync failed", err);
    return {
      project,
      moduleTreeSync: {
        createdL1: 0,
        createdL2: 0,
        skippedExisting: 0,
        paths: (project.featureModules ?? []).length,
      },
    };
  }
}

export async function deleteStudioProject(id: string): Promise<void> {
  const snapshot = await getStudioSnapshot();
  if (!snapshot.projects.some((p) => p.id === id)) throw new Error("项目不存在");

  await writeSupabase(
    async () => {
      const { error } = await sb().from("studio_projects").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    () => {
      applyMemoryMutation((snap) => {
        snap.projects = snap.projects.filter((p) => p.id !== id);
        snap.ideas = snap.ideas.map((i) =>
          i.relatedProjectId === id ? { ...i, relatedProjectId: null } : i
        );
        snap.evolutionLogs = snap.evolutionLogs.filter((e) => e.projectId !== id);
        snap.tasks = snap.tasks.filter((t) => t.projectId !== id);
        snap.assets = snap.assets.filter((a) => a.projectId !== id);
      });
    }
  );
}

export async function createStudioIdea(input: CreateIdeaInput): Promise<Idea> {
  if (!input.title?.trim()) throw new Error("title 必填");

  const snapshot = await getStudioSnapshot();
  if (input.relatedProjectId && !snapshot.projects.some((p) => p.id === input.relatedProjectId)) {
    throw new Error("关联项目不存在");
  }
  if (input.relatedIdeaId && !snapshot.ideas.some((i) => i.id === input.relatedIdeaId)) {
    throw new Error("关联灵感不存在");
  }

  const subtasks = (input.subtasks ?? []).map((item) => ({
    title: item.title.trim(),
    priority: item.priority ?? "P2",
    rationale: item.rationale?.trim() ?? "",
  })).filter((item) => item.title.length > 0);

  const sourceMethod = (input.sourceMethod ?? input.triggerSource ?? "").trim();
  const now = nowIso();
  const idea: Idea = {
    id: studioId("idea-"),
    title: input.title.trim(),
    oneLineIdea: input.oneLineIdea ?? "",
    whyItMatters: input.whyItMatters ?? "",
    aiSupplement: input.aiSupplement ?? "",
    chatTopic: input.chatTopic ?? "",
    triggerSource: input.triggerSource ?? sourceMethod,
    sourceChat: input.sourceChat ?? "",
    sourceMethod,
    emotionLevel: input.emotionLevel ?? "normal",
    type: input.type ?? "product",
    priority: input.priority ?? "P2",
    rawInput: input.rawInput ?? "",
    relatedProjectId: input.relatedProjectId ?? null,
    relatedIdeaId: input.relatedIdeaId ?? null,
    relatedModule: input.relatedModule ?? "",
    subtasks,
    status: input.status ?? "inbox",
    suggestedNextStep: input.suggestedNextStep ?? "",
    decisionNotes: input.decisionNotes ?? "",
    evolutionNotes: input.evolutionNotes ?? "",
    relatedAssetsNote: input.relatedAssetsNote ?? "",
    githubIssueNumber: input.githubIssueNumber ?? null,
    githubIssueUrl: input.githubIssueUrl ?? null,
    githubLabels: input.githubLabels ?? [],
    occurredAt: input.occurredAt?.trim() || now,
    completedAt:
      input.completedAt?.trim() ||
      ((input.status ?? "inbox") === "done" ? now : null),
    createdAt: now,
    updatedAt: now,
  };

  const created = await writeSupabase(
    async () => {
      const { error } = await sb().from("studio_ideas").insert(ideaToRow(idea));
      if (error) throw new Error(error.message);
      return idea;
    },
    () => {
      applyMemoryMutation((snap) => {
        snap.ideas.unshift(idea);
      });
      return idea;
    }
  );

  if (created.relatedProjectId) {
    try {
      const { getPmSlugForStudioProject } = await import("@/lib/project-bridge");
      const { getProjectById } = await import("@/lib/studio/data");
      const { syncStudioIdeasIntoPool } = await import("@/lib/db/local-store");
      const studioProject = await getProjectById(created.relatedProjectId);
      const pmSlug = studioProject ? getPmSlugForStudioProject(studioProject) : null;
      if (pmSlug) {
        await syncStudioIdeasIntoPool(
          pmSlug,
          [
            {
              id: created.id,
              title: created.title,
              oneLineIdea: created.oneLineIdea,
              whyItMatters: created.whyItMatters,
              triggerSource: created.triggerSource,
              sourceChat: created.sourceChat,
              chatTopic: created.chatTopic,
              suggestedNextStep: created.suggestedNextStep,
              priority: created.priority,
              occurredAt: created.occurredAt,
              completedAt: created.completedAt,
              status: created.status,
            },
          ],
          [],
          { actorNote: created.chatTopic || created.sourceChat || created.triggerSource || undefined }
        );
      }
    } catch {
      // 无 PM 映射时跳过，不影响灵感创建
    }
  }

  if (input.syncSubtasksToProject && created.relatedProjectId && created.subtasks.length > 0) {
    await Promise.all(
      created.subtasks.map((subtask) =>
        createStudioTask({
          title: subtask.title,
          projectId: created.relatedProjectId!,
          priority: subtask.priority,
          workload: subtask.rationale,
          sourceIdeaId: created.id,
        })
      )
    );
  }

  return created;
}

export async function updateStudioIdea(id: string, patch: UpdateIdeaInput): Promise<Idea> {
  const snapshot = await getStudioSnapshot();
  const existing = snapshot.ideas.find((i) => i.id === id);
  if (!existing) throw new Error("灵感不存在");

  const now = nowIso();
  const nextStatus = patch.status ?? existing.status;
  let completedAt =
    patch.completedAt !== undefined ? patch.completedAt : existing.completedAt;
  if (nextStatus === "done" && !completedAt) {
    completedAt = now;
  }

  const idea: Idea = {
    ...existing,
    ...patch,
    title: patch.title?.trim() ?? existing.title,
    subtasks: patch.subtasks ?? existing.subtasks,
    sourceMethod:
      patch.sourceMethod !== undefined
        ? patch.sourceMethod
        : patch.triggerSource !== undefined
          ? patch.triggerSource
          : existing.sourceMethod,
    triggerSource:
      patch.triggerSource !== undefined
        ? patch.triggerSource
        : patch.sourceMethod !== undefined
          ? patch.sourceMethod
          : existing.triggerSource,
    occurredAt: patch.occurredAt?.trim() || existing.occurredAt || existing.createdAt,
    completedAt,
    createdAt: existing.createdAt,
    updatedAt: now,
  };

  return writeSupabase(
    async () => {
      const { error } = await sb().from("studio_ideas").upsert(ideaToRow(idea), { onConflict: "id" });
      if (error) throw new Error(error.message);
      return idea;
    },
    () => {
      applyMemoryMutation((snap) => {
        const idx = snap.ideas.findIndex((i) => i.id === id);
        if (idx >= 0) snap.ideas[idx] = idea;
      });
      return idea;
    }
  );
}

export async function deleteStudioIdea(id: string): Promise<void> {
  const snapshot = await getStudioSnapshot();
  if (!snapshot.ideas.some((i) => i.id === id)) throw new Error("灵感不存在");

  await writeSupabase(
    async () => {
      const { error } = await sb().from("studio_ideas").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    () => {
      applyMemoryMutation((snap) => {
        snap.ideas = snap.ideas.filter((i) => i.id !== id);
      });
    }
  );
}

export async function createStudioEvolution(input: CreateEvolutionInput): Promise<EvolutionLog> {
  if (!input.title?.trim()) throw new Error("title 必填");
  if (!input.projectId) throw new Error("projectId 必填");

  const snapshot = await getStudioSnapshot();
  const project = snapshot.projects.find((p) => p.id === input.projectId);
  if (!project) throw new Error("关联项目不存在");

  const { resolveModuleForImport } = await import("@/lib/studio/infer-modules");
  const {
    appendPendingModuleMarker,
    needsModuleFill,
  } = await import("@/lib/studio/inbound-rules");

  const textForInfer = [input.title, input.after, input.before, input.reason]
    .filter(Boolean)
    .join("\n");
  const resolved = resolveModuleForImport(input.module, textForInfer, input.projectId, {
    featureModules: project.featureModules,
    githubRepo: project.githubRepo,
  });
  let decision = input.decision ?? "";
  let reason = input.reason ?? "";
  if (
    needsModuleFill({ relatedProjectId: input.projectId, module: resolved.module })
  ) {
    decision = appendPendingModuleMarker(decision);
  } else if (resolved.inferred && !reason.includes("关键词推断")) {
    reason = reason
      ? `${reason}；板块由关键词推断为「${resolved.module}」`
      : `板块由关键词推断为「${resolved.module}」`;
  }

  const log: EvolutionLog = {
    id: studioId("evo-"),
    title: input.title.trim(),
    projectId: input.projectId,
    logType: input.logType,
    before: input.before ?? "",
    after: input.after ?? "",
    reason,
    decision,
    module: resolved.module,
    releaseTag: input.releaseTag?.trim() || null,
    createdAt: nowIso(),
  };

  return writeSupabase(
    async () => {
      const { error } = await sb().from("studio_evolution_logs").insert(evolutionToRow(log));
      if (error) throw new Error(error.message);
      return log;
    },
    () => {
      applyMemoryMutation((snap) => {
        snap.evolutionLogs.unshift(log);
      });
      return log;
    }
  );
}

export async function updateStudioEvolution(id: string, patch: UpdateEvolutionInput): Promise<EvolutionLog> {
  const snapshot = await getStudioSnapshot();
  const existing = snapshot.evolutionLogs.find((e) => e.id === id);
  if (!existing) throw new Error("演进记录不存在");

  if (patch.projectId && !snapshot.projects.some((p) => p.id === patch.projectId)) {
    throw new Error("关联项目不存在");
  }

  const log: EvolutionLog = {
    ...existing,
    ...patch,
    title: patch.title?.trim() ?? existing.title,
    module:
      patch.module !== undefined ? patch.module.trim() : existing.module,
    releaseTag:
      patch.releaseTag !== undefined
        ? patch.releaseTag?.trim() || null
        : existing.releaseTag,
    createdAt: existing.createdAt,
  };

  return writeSupabase(
    async () => {
      const { error } = await sb()
        .from("studio_evolution_logs")
        .upsert(evolutionToRow(log), { onConflict: "id" });
      if (error) throw new Error(error.message);
      return log;
    },
    () => {
      applyMemoryMutation((snap) => {
        const idx = snap.evolutionLogs.findIndex((e) => e.id === id);
        if (idx >= 0) snap.evolutionLogs[idx] = log;
      });
      return log;
    }
  );
}

export async function deleteStudioEvolution(id: string): Promise<void> {
  const snapshot = await getStudioSnapshot();
  if (!snapshot.evolutionLogs.some((e) => e.id === id)) throw new Error("演进记录不存在");

  await writeSupabase(
    async () => {
      const { error } = await sb().from("studio_evolution_logs").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    () => {
      applyMemoryMutation((snap) => {
        snap.evolutionLogs = snap.evolutionLogs.filter((e) => e.id !== id);
      });
    }
  );
}

function applyTaskPatch(existing: StudioTask, patch: UpdateTaskInput): StudioTask {
  const task: StudioTask = {
    ...existing,
    ...patch,
    title: patch.title?.trim() ?? existing.title,
  };

  if (patch.status === "done" && !task.completedAt) {
    task.completedAt = patch.completedAt ?? nowIso();
  }
  if (patch.status && patch.status !== "done") {
    task.completedAt = null;
  }

  return task;
}

export async function createStudioTask(input: CreateTaskInput): Promise<StudioTask> {
  if (!input.title?.trim()) throw new Error("title 必填");
  if (!input.projectId) throw new Error("projectId 必填");

  const snapshot = await getStudioSnapshot();
  if (!snapshot.projects.some((p) => p.id === input.projectId)) throw new Error("关联项目不存在");

  const task: StudioTask = {
    id: studioId("task-"),
    title: input.title.trim(),
    projectId: input.projectId,
    status: input.status ?? "todo",
    priority: input.priority ?? "P2",
    workload: input.workload ?? "",
    blocker: input.blocker ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    dueDate: input.dueDate ?? null,
    estimateHours: input.estimateHours ?? null,
    actualHours: input.actualHours ?? null,
    completedAt:
      input.completedAt ?? (input.status === "done" ? nowIso() : null),
    progressNote: input.progressNote ?? "",
    completionSource: input.completionSource ?? null,
    gitCommitSha: input.gitCommitSha ?? null,
    gitCommitMessage: input.gitCommitMessage ?? null,
    sourceIdeaId: input.sourceIdeaId ?? null,
  };

  return writeSupabase(
    async () => {
      const { error } = await sb().from("studio_tasks").insert(taskToRow(task));
      if (error) throw new Error(error.message);
      return task;
    },
    () => {
      applyMemoryMutation((snap) => {
        snap.tasks.push(task);
      });
      return task;
    }
  );
}

export async function updateStudioTask(id: string, patch: UpdateTaskInput): Promise<StudioTask> {
  const snapshot = await getStudioSnapshot();
  const existing = snapshot.tasks.find((t) => t.id === id);
  if (!existing) throw new Error("任务不存在");

  if (patch.projectId && !snapshot.projects.some((p) => p.id === patch.projectId)) {
    throw new Error("关联项目不存在");
  }

  const task = applyTaskPatch(existing, patch);

  return writeSupabase(
    async () => {
      const { error } = await sb().from("studio_tasks").upsert(taskToRow(task), { onConflict: "id" });
      if (error) throw new Error(error.message);
      return task;
    },
    () => {
      applyMemoryMutation((snap) => {
        const idx = snap.tasks.findIndex((t) => t.id === id);
        if (idx >= 0) snap.tasks[idx] = task;
      });
      return task;
    }
  );
}

export async function deleteStudioTask(id: string): Promise<void> {
  const snapshot = await getStudioSnapshot();
  if (!snapshot.tasks.some((t) => t.id === id)) throw new Error("任务不存在");

  await writeSupabase(
    async () => {
      const { error } = await sb().from("studio_tasks").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    () => {
      applyMemoryMutation((snap) => {
        snap.tasks = snap.tasks.filter((t) => t.id !== id);
      });
    }
  );
}

export async function createStudioAsset(input: CreateAssetInput): Promise<Asset> {
  if (!input.title?.trim()) throw new Error("title 必填");
  if (!input.projectId) throw new Error("projectId 必填");

  const snapshot = await getStudioSnapshot();
  if (!snapshot.projects.some((p) => p.id === input.projectId)) throw new Error("关联项目不存在");

  assertNoDuplicateAsset(
    snapshot.assets,
    {
      title: input.title.trim(),
      projectId: input.projectId,
      url: input.url,
    },
    input.force
  );

  const asset: Asset = {
    id: studioId("asset-"),
    title: input.title.trim(),
    projectId: input.projectId,
    assetType: input.assetType ?? "inspiration",
    url: input.url ?? "",
    storagePath: input.storagePath ?? null,
    mimeType: input.mimeType ?? null,
    note: input.note ?? "",
    takeaway: input.takeaway ?? "",
    risk: input.risk ?? null,
  };

  return writeSupabase(
    async () => {
      const { error } = await sb().from("studio_assets").insert(assetToRow(asset));
      if (error) throw new Error(error.message);
      return asset;
    },
    () => {
      applyMemoryMutation((snap) => {
        snap.assets.push(asset);
      });
      return asset;
    }
  );
}

export async function updateStudioAsset(id: string, patch: UpdateAssetInput): Promise<Asset> {
  const snapshot = await getStudioSnapshot();
  const existing = snapshot.assets.find((a) => a.id === id);
  if (!existing) throw new Error("资料不存在");

  if (patch.projectId && !snapshot.projects.some((p) => p.id === patch.projectId)) {
    throw new Error("关联项目不存在");
  }

  const asset: Asset = { ...existing, ...patch, title: patch.title?.trim() ?? existing.title };

  return writeSupabase(
    async () => {
      const { error } = await sb().from("studio_assets").upsert(assetToRow(asset), { onConflict: "id" });
      if (error) throw new Error(error.message);
      return asset;
    },
    () => {
      applyMemoryMutation((snap) => {
        const idx = snap.assets.findIndex((a) => a.id === id);
        if (idx >= 0) snap.assets[idx] = asset;
      });
      return asset;
    }
  );
}

export async function deleteStudioAsset(id: string): Promise<void> {
  const snapshot = await getStudioSnapshot();
  if (!snapshot.assets.some((a) => a.id === id)) throw new Error("资料不存在");

  await writeSupabase(
    async () => {
      const { error } = await sb().from("studio_assets").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    () => {
      applyMemoryMutation((snap) => {
        snap.assets = snap.assets.filter((a) => a.id !== id);
      });
    }
  );
}

export async function parkStudioIdea(id: string): Promise<Idea> {
  return updateStudioIdea(id, { status: "parked" });
}

export async function archiveStudioIdea(id: string): Promise<Idea> {
  return updateStudioIdea(id, { status: "archived" });
}

export async function bulkArchiveStudioIdeas(
  ids: string[]
): Promise<{ archived: number; skipped: number }> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  let archived = 0;
  let skipped = 0;
  for (const id of unique) {
    try {
      const snapshot = await getStudioSnapshot();
      const existing = snapshot.ideas.find((i) => i.id === id);
      if (!existing || existing.status === "archived") {
        skipped += 1;
        continue;
      }
      await archiveStudioIdea(id);
      archived += 1;
    } catch {
      skipped += 1;
    }
  }
  return { archived, skipped };
}

export async function completeStudioIdea(id: string): Promise<Idea> {
  return updateStudioIdea(id, { status: "done", completedAt: nowIso() });
}

export type UpsertIdeaFromGitHubInput = {
  title: string;
  rawInput: string;
  oneLineIdea: string;
  whyItMatters: string;
  triggerSource: string;
  type: IdeaType;
  status: IdeaStatus;
  suggestedNextStep: string;
  relatedProjectId: string | null;
  githubIssueNumber: number;
  githubIssueUrl: string;
  githubLabels: string[];
  createdAt: string;
  updatedAt: string;
};

export async function upsertStudioIdeaFromGitHub(
  input: UpsertIdeaFromGitHubInput
): Promise<{ idea: Idea; created: boolean }> {
  const snapshot = await getStudioSnapshot();
  const existing = snapshot.ideas.find((i) => i.githubIssueNumber === input.githubIssueNumber);

  if (existing) {
    const idea = await updateStudioIdea(existing.id, {
      title: input.title,
      rawInput: input.rawInput,
      oneLineIdea: input.oneLineIdea,
      whyItMatters: input.whyItMatters,
      triggerSource: input.triggerSource,
      type: input.type,
      status: input.status,
      suggestedNextStep: input.suggestedNextStep,
      relatedProjectId: input.relatedProjectId,
      githubIssueUrl: input.githubIssueUrl,
      githubLabels: input.githubLabels,
    });
    return { idea, created: false };
  }

  const idea = await createStudioIdea({
    title: input.title,
    rawInput: input.rawInput,
    oneLineIdea: input.oneLineIdea,
    whyItMatters: input.whyItMatters,
    triggerSource: input.triggerSource,
    type: input.type,
    status: input.status,
    suggestedNextStep: input.suggestedNextStep,
    relatedProjectId: input.relatedProjectId,
    githubIssueNumber: input.githubIssueNumber,
    githubIssueUrl: input.githubIssueUrl,
    githubLabels: input.githubLabels,
    occurredAt: input.createdAt,
  });

  if (isSupabaseConfigured()) {
    await sb()
      .from("studio_ideas")
      .update({
        created_at: input.createdAt,
        occurred_at: input.createdAt,
        updated_at: input.updatedAt,
      })
      .eq("id", idea.id);
    invalidateStudioCache();
  } else {
    applyMemoryMutation((snap) => {
      const idx = snap.ideas.findIndex((i) => i.id === idea.id);
      if (idx >= 0) {
        snap.ideas[idx] = {
          ...snap.ideas[idx],
          createdAt: input.createdAt,
          occurredAt: input.createdAt,
          updatedAt: input.updatedAt,
        };
      }
    });
  }

  const refreshed = (await getStudioSnapshot()).ideas.find((i) => i.id === idea.id)!;
  return { idea: refreshed, created: true };
}

export async function convertIdeaToProject(ideaId: string, projectInput?: CreateProjectInput): Promise<{
  idea: Idea;
  project: Project;
}> {
  const snapshot = await getStudioSnapshot();
  const idea = snapshot.ideas.find((i) => i.id === ideaId);
  if (!idea) throw new Error("灵感不存在");

  const nextFromIdea = idea.suggestedNextStep?.trim() || "";
  const defaults: CreateProjectInput = {
    title: idea.title,
    positioning: idea.oneLineIdea || "",
    priority: idea.priority,
    currentStage: "起步",
    nextAction: nextFromIdea,
    portfolioValue: idea.whyItMatters || "",
    body: {
      initialThought: idea.rawInput || idea.oneLineIdea,
      whyThought: idea.whyItMatters,
      positioning: idea.oneLineIdea,
      nextStep: nextFromIdea,
    },
  };

  const project = await createStudioProject({
    ...defaults,
    ...projectInput,
    title: projectInput?.title ?? defaults.title,
    positioning: projectInput?.positioning ?? defaults.positioning,
    priority: projectInput?.priority ?? defaults.priority,
    nextAction: projectInput?.nextAction ?? defaults.nextAction,
    currentStage: projectInput?.currentStage ?? defaults.currentStage,
    portfolioValue: projectInput?.portfolioValue ?? defaults.portfolioValue,
    body: {
      ...defaults.body,
      ...(projectInput?.body ?? {}),
    },
  });

  if (idea.subtasks.length > 0) {
    await Promise.all(
      idea.subtasks.map((sub) =>
        createStudioTask({
          title: sub.title,
          projectId: project.id,
          priority: sub.priority,
          workload: sub.rationale,
          sourceIdeaId: ideaId,
        })
      )
    );
  }

  const updatedIdea = await updateStudioIdea(ideaId, {
    status: "converted",
    relatedProjectId: project.id,
  });

  const evolutionContent = [
    idea.rawInput ? `原始想法：${idea.rawInput}` : "",
    idea.oneLineIdea ? `摘要：${idea.oneLineIdea}` : "",
    idea.whyItMatters ? `为什么：${idea.whyItMatters}` : "",
    idea.aiSupplement ? `AI补充：${idea.aiSupplement}` : "",
    nextFromIdea ? `建议下一步：${nextFromIdea}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  await createStudioEvolution({
    title: "初始想法",
    projectId: project.id,
    logType: "initial",
    before: "",
    after: idea.oneLineIdea || idea.title,
    reason: evolutionContent,
    decision: `来源灵感 ${idea.id} · ${idea.triggerSource || idea.sourceMethod || "手动"}${idea.githubIssueUrl ? ` · ${idea.githubIssueUrl}` : ""}`,
    module: idea.relatedModule?.trim() || "",
  });

  return { idea: updatedIdea, project };
}

/** 从 GitHub 同步 Release + Tag；无 Release body 的 Tag 用 commits 区间补「本版变更」 */
export async function syncStudioProjectReleases(projectId: string): Promise<{
  synced: number;
  releases: StudioRelease[];
  changelogFilled: number;
  /** 从各版 Release body 条目导入为演进的数量 */
  evolutionImported: number;
  evolutionSkipped: number;
}> {
  const snapshot = await getStudioSnapshot();
  let project = snapshot.projects.find((p) => p.id === projectId);
  if (!project) throw new Error("项目不存在");
  const repo = project.githubRepo?.trim();
  if (!repo) throw new Error("项目未配置 GitHub 仓库（githubRepo）");

  const {
    fetchGitHubReleases,
    fetchGitHubTags,
    buildRepoUrl,
    fetchCommitDate,
    fetchCompareCommits,
  } = await import("@/lib/github/client");
  const {
    compareVersionTags,
    formatCommitsAsChangelog,
    isSemverReleaseTag,
    hasStructuredReleaseBody,
  } = await import("@/lib/studio/release-notes");
  const { resolveFeatureModules, detectModuleCatalog } = await import(
    "@/lib/studio/project-modules"
  );

  // 未自定义板块时，按仓库目录写入默认功能面（如 chris-phone）
  if (!project.featureModules?.length) {
    const catalog = detectModuleCatalog(project.id, repo);
    if (catalog !== "generic") {
      const defaults = resolveFeatureModules(project.id, null, repo);
      const synced = await updateStudioProjectWithModuleSync(projectId, {
        featureModules: defaults,
      });
      project = { ...synced.project, featureModules: defaults };
    }
  }

  const [ghReleases, ghTags] = await Promise.all([
    fetchGitHubReleases(repo),
    fetchGitHubTags(repo, 100),
  ]);

  const syncedAt = nowIso();
  const byTag = new Map<string, StudioRelease>();
  const tagSha = new Map<string, string>();

  for (const r of ghReleases) {
    const tag = r.tag_name.trim();
    if (!tag) continue;
    byTag.set(tag, {
      id: `rel-${projectId}-${tag}`.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120),
      projectId,
      tag,
      name: (r.name || tag).trim(),
      publishedAt: r.published_at,
      body: r.body ?? "",
      htmlUrl: r.html_url,
      isPrerelease: Boolean(r.prerelease),
      source: "release",
      syncedAt,
    });
  }

  for (const t of ghTags) {
    const tag = t.name.trim();
    if (!tag) continue;
    if (t.commit?.sha) tagSha.set(tag, t.commit.sha);
    if (byTag.has(tag)) continue;
    byTag.set(tag, {
      id: `rel-${projectId}-${tag}`.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120),
      projectId,
      tag,
      name: tag,
      publishedAt: null,
      body: "",
      htmlUrl: `${buildRepoUrl(repo)}/releases/tag/${encodeURIComponent(tag)}`,
      isPrerelease: false,
      source: "tag",
      syncedAt,
    });
  }

  // 全部 Tag 可补发布时间；变更说明只在「语义化版本」相邻之间算 commits
  // （避免 stage/ nest/ 过程 Tag 插在中间导致 compare 失败或空结果）
  const ascending = [...byTag.keys()].sort(compareVersionTags);
  const semverAscending = ascending.filter(isSemverReleaseTag);
  let changelogFilled = 0;
  const FILL_LIMIT = 40;

  for (const tag of ascending) {
    const current = byTag.get(tag);
    if (!current) continue;
    if (!current.publishedAt && tagSha.get(tag)) {
      try {
        const date = await fetchCommitDate(repo, tagSha.get(tag)!);
        if (date) current.publishedAt = date;
      } catch {
        /* ignore */
      }
    }
  }

  for (
    let i = semverAscending.length - 1;
    i >= 0 && changelogFilled < FILL_LIMIT;
    i--
  ) {
    const tag = semverAscending[i];
    const current = byTag.get(tag);
    if (!current) continue;

    // 已有结构化 Release 说明（含 `- ` 列表）则不覆盖
    if (hasStructuredReleaseBody(current.body)) continue;

    const prev = i > 0 ? semverAscending[i - 1] : null;
    try {
      if (prev) {
        const commits = await fetchCompareCommits(repo, prev, tag);
        const body = formatCommitsAsChangelog(commits);
        if (body) {
          current.body = body;
          changelogFilled++;
        }
      } else {
        // 最早一版：用该 tag 上近期 commits 顶一下
        const { fetchRecentCommits } = await import("@/lib/github/client");
        const commits = await fetchRecentCommits(repo, tag, 15);
        const body = formatCommitsAsChangelog(commits);
        if (body) {
          current.body = body;
          changelogFilled++;
        }
      }
    } catch {
      /* 个别 tag compare 失败不阻断整次同步 */
    }
  }

  const next = [...byTag.values()].sort((a, b) => {
    const byDate = (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
    if (byDate) return byDate;
    return compareVersionTags(b.tag, a.tag);
  });

  const synced = await writeSupabase(
    async () => {
      const client = sb();
      await client.from("studio_releases").delete().eq("project_id", projectId);
      if (next.length) {
        const { error } = await client
          .from("studio_releases")
          .upsert(next.map(releaseToRow), { onConflict: "id" });
        if (error) throw new Error(error.message);
      }
      return { synced: next.length, releases: next, changelogFilled };
    },
    () => {
      applyMemoryMutation((snap) => {
        snap.releases = [
          ...(snap.releases ?? []).filter((r) => r.projectId !== projectId),
          ...next,
        ];
      });
      return { synced: next.length, releases: next, changelogFilled };
    }
  );

  // 同步后：把各版说明条目导入为带 releaseTag 的演进，并关键词推断板块
  const bodyImport = await importReleaseBodiesAsEvolution(projectId);
  return {
    ...synced,
    evolutionImported: bodyImport.imported,
    evolutionSkipped: bodyImport.skipped,
  };
}

/**
 * 汇总 PM 内带板块的变更，创建 GitHub Release，并把未挂版本的演进挂上本 tag。
 * 用于「发版时带上新增内容 + 对应模块」。
 */
export async function publishStudioProjectRelease(input: {
  projectId: string;
  tag: string;
  name?: string;
  /** 默认用项目 githubBranch 或 main */
  targetCommitish?: string;
  /** 额外说明，拼在正文前 */
  extraBody?: string;
  /** 把未挂版本且有板块的演进挂到本 tag */
  attachUntaggedEvolution?: boolean;
  draft?: boolean;
  prerelease?: boolean;
}): Promise<{
  release: StudioRelease;
  githubUrl: string;
  modules: string[];
  attachedEvolutionIds: string[];
}> {
  const snapshot = await getStudioSnapshot();
  const project = snapshot.projects.find((p) => p.id === input.projectId);
  if (!project) throw new Error("项目不存在");
  const repo = project.githubRepo?.trim();
  if (!repo) throw new Error("项目未配置 GitHub 仓库（githubRepo）");

  const tag = input.tag.trim();
  if (!tag) throw new Error("tag 必填");

  const { createGitHubRelease, buildRepoUrl } = await import("@/lib/github/client");
  const { groupChangesByModule, formatReleaseNotesMarkdown, modulesForReleaseTag } =
    await import("@/lib/studio/release-notes");

  const attach = input.attachUntaggedEvolution !== false;
  const attachedEvolutionIds: string[] = [];

  if (attach) {
    const untagged = snapshot.evolutionLogs.filter(
      (e) =>
        e.projectId === input.projectId &&
        !e.releaseTag?.trim() &&
        e.module?.trim()
    );
    for (const e of untagged) {
      await updateStudioEvolution(e.id, { releaseTag: tag });
      attachedEvolutionIds.push(e.id);
    }
  }

  const fresh = await getStudioSnapshot();
  const evolution = fresh.evolutionLogs.filter((e) => e.projectId === input.projectId);
  const groups = groupChangesByModule({
    evolution,
    releaseTag: tag,
  });
  const body = [
    input.extraBody?.trim() ?? "",
    formatReleaseNotesMarkdown({
      title: input.name || tag,
      groups,
    }),
  ]
    .filter(Boolean)
    .join("\n\n");

  const gh = await createGitHubRelease(repo, {
    tag,
    name: input.name || tag,
    body,
    targetCommitish: input.targetCommitish || project.githubBranch || "main",
    draft: input.draft,
    prerelease: input.prerelease,
  });

  // 刷新本地 releases 缓存
  await syncStudioProjectReleases(input.projectId);
  const after = await getStudioSnapshot();
  const release =
    after.releases.find((r) => r.projectId === input.projectId && r.tag === tag) ??
    ({
      id: `rel-${input.projectId}-${tag}`.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120),
      projectId: input.projectId,
      tag,
      name: gh.name || tag,
      publishedAt: gh.published_at,
      body: gh.body ?? body,
      htmlUrl: gh.html_url,
      isPrerelease: Boolean(gh.prerelease),
      source: "release" as const,
      syncedAt: nowIso(),
    } satisfies StudioRelease);

  return {
    release,
    githubUrl: gh.html_url || `${buildRepoUrl(repo)}/releases/tag/${encodeURIComponent(tag)}`,
    modules: modulesForReleaseTag(tag, evolution),
    attachedEvolutionIds,
  };
}

/**
 * 从 CHANGELOG.md（或传入 markdown）导入各版本条目为演进：
 * 每条带 releaseTag，并按关键词推断板块。
 */
export async function importChangelogAsEvolution(input: {
  projectId: string;
  markdown?: string;
  /** 默认读仓库根 CHANGELOG.md */
  fromRepoFile?: boolean;
}): Promise<{
  imported: number;
  skipped: number;
  inferredModules: number;
  pendingModules: number;
  items: Array<{ id: string; title: string; releaseTag: string | null; module: string }>;
}> {
  const {
    buildChangelogEvolutionItems,
    filterNewChangelogItems,
    readRepoChangelog,
  } = await import("@/lib/studio/import-changelog");

  const snapshot = await getStudioSnapshot();
  if (!snapshot.projects.some((p) => p.id === input.projectId)) {
    throw new Error("项目不存在");
  }

  const md =
    input.markdown?.trim() ||
    (input.fromRepoFile !== false && !input.markdown ? readRepoChangelog() : "");
  if (!md.trim()) throw new Error("无 CHANGELOG 内容可导入");

  const built = buildChangelogEvolutionItems(md, input.projectId);
  const fresh = filterNewChangelogItems(built, snapshot.evolutionLogs, input.projectId);
  const skipped = built.length - fresh.length;

  const items: Array<{
    id: string;
    title: string;
    releaseTag: string | null;
    module: string;
  }> = [];
  let inferredModules = 0;
  let pendingModules = 0;

  for (const item of fresh) {
    if (item.module) inferredModules += 1;
    else pendingModules += 1;
    const log = await createStudioEvolution({
      title: item.title,
      projectId: input.projectId,
      logType: item.logType,
      after: item.after,
      reason: item.reason,
      decision: item.decision,
      module: item.module || undefined,
      releaseTag: item.releaseTag,
    });
    items.push({
      id: log.id,
      title: log.title,
      releaseTag: log.releaseTag,
      module: log.module,
    });
  }

  return {
    imported: items.length,
    skipped,
    inferredModules,
    pendingModules,
    items,
  };
}

/**
 * 从已同步的 GitHub Release/Tag body 条目导入为演进（带 releaseTag + 关键词板块）。
 * 用于「同步版本」后把各版说明拆成可追溯需求/变更。
 */
export async function importReleaseBodiesAsEvolution(
  projectId: string
): Promise<{
  imported: number;
  skipped: number;
  inferredModules: number;
  pendingModules: number;
}> {
  const { stripBulletDecor } = await import("@/lib/studio/import-changelog");
  const { resolveModuleForImport } = await import("@/lib/studio/infer-modules");
  const { extractReleaseBodyItems } = await import("@/lib/studio/release-notes");

  const snapshot = await getStudioSnapshot();
  const project = snapshot.projects.find((p) => p.id === projectId);
  if (!project) {
    throw new Error("项目不存在");
  }

  const releases = (snapshot.releases ?? []).filter((r) => r.projectId === projectId);
  const have = new Set(
    snapshot.evolutionLogs
      .filter((e) => e.projectId === projectId)
      .map((e) => `${e.releaseTag ?? ""}::${e.title}`)
  );

  let imported = 0;
  let skipped = 0;
  let inferredModules = 0;
  let pendingModules = 0;

  for (const rel of releases) {
    const bullets = extractReleaseBodyItems(rel.body ?? "");

    for (const bullet of bullets) {
      const clean = stripBulletDecor(bullet);
      const title =
        clean.length > 80 ? `${clean.slice(0, 77)}…` : clean || `${rel.tag} 变更`;
      const key = `${rel.tag}::${title}`;
      if (have.has(key)) {
        skipped += 1;
        continue;
      }
      const resolved = resolveModuleForImport(null, `${title}\n${bullet}`, projectId, {
        featureModules: project.featureModules,
        githubRepo: project.githubRepo,
      });
      if (resolved.module) inferredModules += 1;
      else pendingModules += 1;

      const log = await createStudioEvolution({
        title,
        projectId,
        logType: "feature_add",
        after: bullet,
        reason: resolved.module
          ? `自 Release ${rel.tag} 说明导入；板块推断为「${resolved.module}」`
          : `自 Release ${rel.tag} 说明导入；未能推断板块`,
        module: resolved.module || undefined,
        releaseTag: rel.tag,
      });
      have.add(`${log.releaseTag ?? ""}::${log.title}`);
      imported += 1;
    }
  }

  return { imported, skipped, inferredModules, pendingModules };
}
