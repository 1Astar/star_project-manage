import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  assetToRow,
  evolutionToRow,
  ideaToRow,
  projectToRow,
  taskToRow,
} from "@/lib/studio/mappers";
import {
  applyMemoryMutation,
  ensureStudioReady,
  getStudioSnapshot,
  invalidateStudioCache,
} from "@/lib/studio/store";
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
  relatedPageUrl?: string | null;
  portfolioValue?: string;
  body?: Partial<ProjectBody>;
};

export type UpdateProjectInput = Partial<CreateProjectInput>;

export type CreateIdeaInput = {
  title: string;
  oneLineIdea?: string;
  whyItMatters?: string;
  triggerSource?: string;
  emotionLevel?: EmotionLevel;
  type?: IdeaType;
  priority?: IdeaPriority;
  rawInput?: string;
  relatedProjectId?: string | null;
  relatedIdeaId?: string | null;
  subtasks?: IdeaSubtask[];
  status?: IdeaStatus;
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
  dueDate?: string | null;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

export type CreateAssetInput = {
  title: string;
  projectId: string;
  assetType?: AssetType;
  url?: string;
  note?: string;
  takeaway?: string;
  risk?: string | null;
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
    relatedPageUrl:
      input.relatedPageUrl !== undefined ? input.relatedPageUrl : (existing?.relatedPageUrl ?? null),
    portfolioValue: input.portfolioValue ?? existing?.portfolioValue ?? "",
    body: {
      ...EMPTY_BODY,
      ...(existing?.body ?? {}),
      ...(input.body ?? {}),
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function createStudioProject(input: CreateProjectInput): Promise<Project> {
  if (!input.title?.trim()) throw new Error("title 必填");

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
  if (input.relatedProjectId && input.relatedIdeaId) {
    throw new Error("只能关联项目或灵感其中之一");
  }

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

  const idea: Idea = {
    id: studioId("idea-"),
    title: input.title.trim(),
    oneLineIdea: input.oneLineIdea ?? "",
    whyItMatters: input.whyItMatters ?? "",
    triggerSource: input.triggerSource ?? "",
    emotionLevel: input.emotionLevel ?? "normal",
    type: input.type ?? "product",
    priority: input.priority ?? "P2",
    rawInput: input.rawInput ?? "",
    relatedProjectId: input.relatedProjectId ?? null,
    relatedIdeaId: input.relatedIdeaId ?? null,
    subtasks,
    status: input.status ?? "inbox",
    createdAt: nowIso(),
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

  if (input.syncSubtasksToProject && created.relatedProjectId && created.subtasks.length > 0) {
    await Promise.all(
      created.subtasks.map((subtask) =>
        createStudioTask({
          title: subtask.title,
          projectId: created.relatedProjectId!,
          priority: subtask.priority,
          workload: subtask.rationale,
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

  const idea: Idea = {
    ...existing,
    ...patch,
    title: patch.title?.trim() ?? existing.title,
    subtasks: patch.subtasks ?? existing.subtasks,
    createdAt: existing.createdAt,
  };

  if (idea.relatedProjectId && idea.relatedIdeaId) {
    throw new Error("只能关联项目或灵感其中之一");
  }

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
  if (!snapshot.projects.some((p) => p.id === input.projectId)) throw new Error("关联项目不存在");

  const log: EvolutionLog = {
    id: studioId("evo-"),
    title: input.title.trim(),
    projectId: input.projectId,
    logType: input.logType,
    before: input.before ?? "",
    after: input.after ?? "",
    reason: input.reason ?? "",
    decision: input.decision ?? "",
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
    dueDate: input.dueDate ?? null,
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

  const task: StudioTask = { ...existing, ...patch, title: patch.title?.trim() ?? existing.title };

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

  const asset: Asset = {
    id: studioId("asset-"),
    title: input.title.trim(),
    projectId: input.projectId,
    assetType: input.assetType ?? "inspiration",
    url: input.url ?? "",
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

export async function convertIdeaToProject(ideaId: string, projectInput?: CreateProjectInput): Promise<{
  idea: Idea;
  project: Project;
}> {
  const snapshot = await getStudioSnapshot();
  const idea = snapshot.ideas.find((i) => i.id === ideaId);
  if (!idea) throw new Error("灵感不存在");

  const project = await createStudioProject({
    title: projectInput?.title ?? idea.title,
    positioning: projectInput?.positioning ?? idea.oneLineIdea,
    body: {
      initialThought: idea.oneLineIdea,
      whyThought: idea.whyItMatters,
      ...(projectInput?.body ?? {}),
    },
    ...projectInput,
  });

  const updatedIdea = await updateStudioIdea(ideaId, {
    status: "converted",
    relatedProjectId: project.id,
  });

  return { idea: updatedIdea, project };
}
