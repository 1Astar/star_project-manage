import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  assetToRow,
  evolutionToRow,
  ideaToRow,
  projectToRow,
  rowToAsset,
  rowToEvolution,
  rowToIdea,
  rowToProject,
  rowToTask,
  taskToRow,
  type StudioAssetRow,
  type StudioEvolutionRow,
  type StudioIdeaRow,
  type StudioProjectRow,
  type StudioTaskRow,
} from "@/lib/studio/mappers";
import { getStudioSeedData } from "@/lib/studio/mock-data";
import type { Asset, EvolutionLog, Idea, Project, StudioTask } from "@/lib/studio/types";

export interface StudioSnapshot {
  projects: Project[];
  ideas: Idea[];
  evolutionLogs: EvolutionLog[];
  tasks: StudioTask[];
  assets: Asset[];
}

let memorySnapshot: StudioSnapshot | null = null;

function sb() {
  const client = createServiceClient();
  if (!client) throw new Error("Supabase 未配置");
  return client;
}

async function loadTable<T>(table: string, order?: { column: string; ascending: boolean }) {
  let query = sb().from(table).select("*");
  if (order) {
    query = query.order(order.column, { ascending: order.ascending });
  }
  const { data, error } = await query;
  if (error) {
    if (error.message.includes(table)) return [] as T[];
    throw new Error(`${table}: ${error.message}`);
  }
  return (data ?? []) as T[];
}

async function readFromSupabase(): Promise<StudioSnapshot> {
  const [projectRows, ideaRows, evolutionRows, taskRows, assetRows] = await Promise.all([
    loadTable<StudioProjectRow>("studio_projects", { column: "updated_at", ascending: false }),
    loadTable<StudioIdeaRow>("studio_ideas", { column: "created_at", ascending: false }),
    loadTable<StudioEvolutionRow>("studio_evolution_logs", { column: "created_at", ascending: false }),
    loadTable<StudioTaskRow>("studio_tasks"),
    loadTable<StudioAssetRow>("studio_assets"),
  ]);

  return {
    projects: projectRows.map(rowToProject),
    ideas: ideaRows.map(rowToIdea),
    evolutionLogs: evolutionRows.map(rowToEvolution),
    tasks: taskRows.map(rowToTask),
    assets: assetRows.map(rowToAsset),
  };
}

async function upsertSnapshot(snapshot: StudioSnapshot) {
  const client = sb();
  const tables: Array<{ table: string; rows: object[] }> = [
    { table: "studio_projects", rows: snapshot.projects.map(projectToRow) },
    { table: "studio_ideas", rows: snapshot.ideas.map(ideaToRow) },
    { table: "studio_evolution_logs", rows: snapshot.evolutionLogs.map(evolutionToRow) },
    { table: "studio_tasks", rows: snapshot.tasks.map(taskToRow) },
    { table: "studio_assets", rows: snapshot.assets.map(assetToRow) },
  ];

  for (const { table, rows } of tables) {
    if (!rows.length) continue;
    const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
  }
}

function mergeIntoMemory(target: StudioSnapshot, incoming: StudioSnapshot) {
  const upsert = <T extends { id: string }>(list: T[], items: T[]) => {
    for (const item of items) {
      const idx = list.findIndex((x) => x.id === item.id);
      if (idx >= 0) list[idx] = item;
      else list.push(item);
    }
  };
  upsert(target.projects, incoming.projects);
  upsert(target.ideas, incoming.ideas);
  upsert(target.evolutionLogs, incoming.evolutionLogs);
  upsert(target.tasks, incoming.tasks);
  upsert(target.assets, incoming.assets);
}

export async function upsertStudioSnapshot(snapshot: StudioSnapshot): Promise<void> {
  if (isSupabaseConfigured()) {
    await upsertSnapshot(snapshot);
    invalidateStudioCache();
    return;
  }

  applyMemoryMutation((mem) => {
    mergeIntoMemory(mem, snapshot);
  });
}

async function ensureSupabaseStudio(): Promise<StudioSnapshot> {
  const snapshot = await readFromSupabase();
  if (snapshot.projects.length > 0) {
    memorySnapshot = snapshot;
    return snapshot;
  }

  const seeded = getStudioSeedData();
  await upsertSnapshot(seeded);
  memorySnapshot = seeded;
  return seeded;
}

function readMemoryFallback(): StudioSnapshot {
  if (!memorySnapshot) {
    memorySnapshot = getStudioSeedData();
  }
  return memorySnapshot;
}

export async function getStudioSnapshot(): Promise<StudioSnapshot> {
  if (isSupabaseConfigured()) {
    try {
      return await ensureSupabaseStudio();
    } catch {
      return readMemoryFallback();
    }
  }
  return readMemoryFallback();
}

export function invalidateStudioCache() {
  memorySnapshot = null;
}

export function applyMemoryMutation(mutator: (snap: StudioSnapshot) => void) {
  const snap = structuredClone(readMemoryFallback());
  mutator(snap);
  memorySnapshot = snap;
}

export async function ensureStudioReady(): Promise<void> {
  await getStudioSnapshot();
}
