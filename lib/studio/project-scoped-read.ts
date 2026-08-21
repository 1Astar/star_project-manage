/**
 * 按项目读 Studio 子集，禁止为详情页拉全库 getStudioSnapshot。
 */
import { isDemoPublicScope } from "@/lib/demo/scope";
import { DEMO_SHOWCASE_STUDIO_ID, isDemoShowcaseId } from "@/lib/demo/showcase";
import { memoizeDurableRead } from "@/lib/runtime/durable-read-memo";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServiceClient } from "@/lib/supabase/server";
import {
  rowToAsset,
  rowToChangeSession,
  rowToEvolution,
  rowToIdea,
  rowToProject,
  rowToRelease,
  rowToTask,
  type StudioAssetRow,
  type StudioChangeSessionRow,
  type StudioEvolutionRow,
  type StudioIdeaRow,
  type StudioProjectRow,
  type StudioReleaseRow,
  type StudioTaskRow,
} from "@/lib/studio/mappers";
import { getStudioSnapshot } from "@/lib/studio/store";
import type {
  Asset,
  ChangeSession,
  EvolutionLog,
  Idea,
  Project,
  StudioRelease,
  StudioTask,
} from "@/lib/studio/types";

export type StudioProjectBundle = {
  project: Project | null;
  ideas: Idea[];
  tasks: StudioTask[];
  evolutionLogs: EvolutionLog[];
  changeSessions: ChangeSession[];
  assets: Asset[];
  releases: StudioRelease[];
};

function sb() {
  const client = createServiceClient();
  if (!client) throw new Error("Supabase 未配置");
  return client;
}

async function assertProjectReadable(projectId: string): Promise<boolean> {
  if (!(await isDemoPublicScope())) return true;
  return isDemoShowcaseId(projectId);
}

async function readProjectRow(projectId: string): Promise<Project | null> {
  const { data, error } = await sb()
    .from("studio_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(`studio_projects: ${error.message}`);
  if (!data) return null;
  return rowToProject(data as StudioProjectRow);
}

async function readProjectScopedFromSupabase(
  projectId: string
): Promise<StudioProjectBundle> {
  const [
    project,
    ideaRows,
    taskRows,
    evolutionRows,
    sessionRows,
    assetRows,
    releaseRows,
  ] = await Promise.all([
    readProjectRow(projectId),
    sb()
      .from("studio_ideas")
      .select("*")
      .eq("related_project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(300),
    sb().from("studio_tasks").select("*").eq("project_id", projectId),
    sb()
      .from("studio_evolution_logs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(200),
    sb()
      .from("studio_change_sessions")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(200),
    sb()
      .from("studio_assets")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(100),
    sb()
      .from("studio_releases")
      .select("*")
      .eq("project_id", projectId)
      .order("published_at", { ascending: false })
      .limit(50),
  ]);

  const fail = (label: string, err: { message: string } | null) => {
    if (err) throw new Error(`${label}: ${err.message}`);
  };
  fail("studio_ideas", ideaRows.error);
  fail("studio_tasks", taskRows.error);
  fail("studio_evolution_logs", evolutionRows.error);
  fail("studio_change_sessions", sessionRows.error);
  fail("studio_assets", assetRows.error);
  fail("studio_releases", releaseRows.error);

  return {
    project,
    ideas: ((ideaRows.data ?? []) as StudioIdeaRow[]).map(rowToIdea),
    tasks: ((taskRows.data ?? []) as StudioTaskRow[]).map(rowToTask),
    evolutionLogs: ((evolutionRows.data ?? []) as StudioEvolutionRow[]).map(
      rowToEvolution
    ),
    changeSessions: ((sessionRows.data ?? []) as StudioChangeSessionRow[]).map(
      rowToChangeSession
    ),
    assets: ((assetRows.data ?? []) as StudioAssetRow[]).map(rowToAsset),
    releases: ((releaseRows.data ?? []) as StudioReleaseRow[]).map(rowToRelease),
  };
}

function filterFromFull(projectId: string, snap: Awaited<ReturnType<typeof getStudioSnapshot>>): StudioProjectBundle {
  return {
    project: snap.projects.find((p) => p.id === projectId) ?? null,
    ideas: snap.ideas.filter((i) => i.relatedProjectId === projectId),
    tasks: snap.tasks.filter((t) => t.projectId === projectId),
    evolutionLogs: snap.evolutionLogs
      .filter((e) => e.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    changeSessions: (snap.changeSessions ?? [])
      .filter((c) => c.projectId === projectId)
      .sort(
        (a, b) =>
          b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt)
      ),
    assets: snap.assets.filter((a) => a.projectId === projectId),
    releases: (snap.releases ?? [])
      .filter((r) => r.projectId === projectId)
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")),
  };
}

/** 请求内 memo：同一项目详情页多次 getProject* 只打一轮库 */
export async function getStudioProjectBundle(
  projectId: string
): Promise<StudioProjectBundle> {
  if (!(await assertProjectReadable(projectId))) {
    return {
      project: null,
      ideas: [],
      tasks: [],
      evolutionLogs: [],
      changeSessions: [],
      assets: [],
      releases: [],
    };
  }

  const id =
    (await isDemoPublicScope()) && isDemoShowcaseId(projectId)
      ? DEMO_SHOWCASE_STUDIO_ID
      : projectId;

  return memoizeDurableRead(`studio-project:${id}`, async () => {
    if (isSupabaseConfigured()) {
      try {
        return await readProjectScopedFromSupabase(id);
      } catch (e) {
        console.error("project-scoped studio failed", id, e);
      }
    }
    return filterFromFull(id, await getStudioSnapshot());
  });
}

export async function getStudioProjectRow(projectId: string): Promise<Project | null> {
  if (!(await assertProjectReadable(projectId))) return null;
  const id =
    (await isDemoPublicScope()) && isDemoShowcaseId(projectId)
      ? DEMO_SHOWCASE_STUDIO_ID
      : projectId;

  return memoizeDurableRead(`studio-project-row:${id}`, async () => {
    if (isSupabaseConfigured()) {
      try {
        return await readProjectRow(id);
      } catch (e) {
        console.error("studio project row failed", id, e);
      }
    }
    const snap = await getStudioSnapshot();
    return snap.projects.find((p) => p.id === id) ?? null;
  });
}
