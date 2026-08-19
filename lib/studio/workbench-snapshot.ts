/**
 * 工作台专用 Studio 快照：按行/时间窗裁剪，避免整库 select *。
 * 项目详情页仍走 getStudioSnapshot() 全量。
 */
import { DEMO_SHOWCASE_STUDIO_ID } from "@/lib/demo/showcase";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServiceClient } from "@/lib/supabase/server";
import { memoizeDurableRead } from "@/lib/runtime/durable-read-memo";
import {
  rowToAsset,
  rowToChangeSession,
  rowToColumnDef,
  rowToEvolution,
  rowToIdea,
  rowToProject,
  rowToRelease,
  rowToTask,
  type StudioAssetRow,
  type StudioChangeSessionRow,
  type StudioEvolutionRow,
  type StudioIdeaRow,
  type StudioProjectColumnDefRow,
  type StudioProjectRow,
  type StudioReleaseRow,
  type StudioTaskRow,
} from "@/lib/studio/mappers";
import {
  getStudioSnapshot,
  type StudioSnapshot,
} from "@/lib/studio/store";

/** 星图灵感条数上限 */
export const WORKBENCH_IDEA_LIMIT = 400;
/** 改进日历：演进回看天数 */
export const WORKBENCH_EVOLUTION_DAYS = 90;
/** 改进日历 / 明日议程：变更会话回看天数 */
export const WORKBENCH_SESSION_DAYS = 60;

function shanghaiDay(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addShanghaiDays(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00+08:00`);
  d.setDate(d.getDate() + delta);
  return shanghaiDay(d.toISOString());
}

function daysAgoIso(days: number): string {
  const day = addShanghaiDays(shanghaiDay(), -(days - 1));
  return `${day}T00:00:00.000+08:00`;
}

function sb() {
  const client = createServiceClient();
  if (!client) throw new Error("Supabase 未配置");
  return client;
}

async function loadOrdered<T>(
  table: string,
  opts: {
    order?: { column: string; ascending: boolean };
    eq?: { column: string; value: string };
    gte?: { column: string; value: string };
    or?: string;
    limit?: number;
  } = {}
): Promise<T[]> {
  let query = sb().from(table).select("*");
  if (opts.eq) query = query.eq(opts.eq.column, opts.eq.value);
  if (opts.gte) query = query.gte(opts.gte.column, opts.gte.value);
  if (opts.or) query = query.or(opts.or);
  if (opts.order) {
    query = query.order(opts.order.column, { ascending: opts.order.ascending });
  }
  if (opts.limit != null) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) {
    if (error.message.includes(table)) return [] as T[];
    throw new Error(`${table}: ${error.message}`);
  }
  return (data ?? []) as T[];
}

function normalize(snapshot: StudioSnapshot): StudioSnapshot {
  if (!snapshot.releases) snapshot.releases = [];
  if (!snapshot.projectColumnDefs) snapshot.projectColumnDefs = [];
  if (!snapshot.changeSessions) snapshot.changeSessions = [];
  for (const p of snapshot.projects) {
    if (!p.customFields) p.customFields = {};
  }
  return snapshot;
}

/** 访客演示：只查演示项目相关行，不下载全库 */
export async function readDemoStudioSnapshot(): Promise<StudioSnapshot> {
  const id = DEMO_SHOWCASE_STUDIO_ID;
  const [
    projectRows,
    ideaRows,
    evolutionRows,
    taskRows,
    assetRows,
    releaseRows,
    changeSessionRows,
  ] = await Promise.all([
    loadOrdered<StudioProjectRow>("studio_projects", {
      eq: { column: "id", value: id },
    }),
    loadOrdered<StudioIdeaRow>("studio_ideas", {
      eq: { column: "related_project_id", value: id },
      order: { column: "created_at", ascending: false },
      limit: 50,
    }),
    loadOrdered<StudioEvolutionRow>("studio_evolution_logs", {
      eq: { column: "project_id", value: id },
      order: { column: "created_at", ascending: false },
      limit: 50,
    }),
    loadOrdered<StudioTaskRow>("studio_tasks", {
      eq: { column: "project_id", value: id },
    }),
    loadOrdered<StudioAssetRow>("studio_assets", {
      eq: { column: "project_id", value: id },
      limit: 20,
    }),
    loadOrdered<StudioReleaseRow>("studio_releases", {
      eq: { column: "project_id", value: id },
      order: { column: "published_at", ascending: false },
      limit: 20,
    }),
    loadOrdered<StudioChangeSessionRow>("studio_change_sessions", {
      eq: { column: "project_id", value: id },
      order: { column: "created_at", ascending: false },
      limit: 50,
    }),
  ]);

  return normalize({
    projects: projectRows.map(rowToProject),
    ideas: ideaRows.map(rowToIdea),
    evolutionLogs: evolutionRows.map(rowToEvolution),
    tasks: taskRows.map(rowToTask),
    assets: assetRows.map(rowToAsset),
    releases: releaseRows.map(rowToRelease),
    projectColumnDefs: [],
    changeSessions: changeSessionRows.map(rowToChangeSession),
  });
}

/** 登录工作台：项目/任务全量；灵感/演进/会话按窗口裁剪；资源/发版不拉 */
async function readWorkbenchStudioFromSupabase(): Promise<StudioSnapshot> {
  const evoSince = daysAgoIso(WORKBENCH_EVOLUTION_DAYS);
  const sessionSince = daysAgoIso(WORKBENCH_SESSION_DAYS);

  const [
    projectRows,
    ideaRows,
    evolutionRows,
    taskRows,
    columnRows,
    changeSessionRows,
  ] = await Promise.all([
    loadOrdered<StudioProjectRow>("studio_projects", {
      order: { column: "updated_at", ascending: false },
    }),
    loadOrdered<StudioIdeaRow>("studio_ideas", {
      order: { column: "created_at", ascending: false },
      limit: WORKBENCH_IDEA_LIMIT,
    }),
    loadOrdered<StudioEvolutionRow>("studio_evolution_logs", {
      gte: { column: "created_at", value: evoSince },
      order: { column: "created_at", ascending: false },
      limit: 800,
    }),
    loadOrdered<StudioTaskRow>("studio_tasks"),
    loadOrdered<StudioProjectColumnDefRow>("studio_project_column_defs", {
      order: { column: "sort_order", ascending: true },
    }),
    loadOrdered<StudioChangeSessionRow>("studio_change_sessions", {
      or: `human_acceptance.eq.unreviewed,created_at.gte.${sessionSince}`,
      order: { column: "created_at", ascending: false },
      limit: 500,
    }),
  ]);

  return normalize({
    projects: projectRows.map(rowToProject),
    ideas: ideaRows.map(rowToIdea),
    evolutionLogs: evolutionRows.map(rowToEvolution),
    tasks: taskRows.map(rowToTask),
    assets: [],
    releases: [],
    projectColumnDefs: columnRows.map(rowToColumnDef),
    changeSessions: changeSessionRows.map(rowToChangeSession),
  });
}

function capFromFull(snap: StudioSnapshot): StudioSnapshot {
  const evoOldest = daysAgoIso(WORKBENCH_EVOLUTION_DAYS);
  const sessionOldestDay = addShanghaiDays(shanghaiDay(), -(WORKBENCH_SESSION_DAYS - 1));
  return normalize({
    projects: snap.projects,
    ideas: [...snap.ideas]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, WORKBENCH_IDEA_LIMIT),
    evolutionLogs: snap.evolutionLogs.filter((e) => e.createdAt >= evoOldest),
    tasks: snap.tasks,
    assets: [],
    releases: [],
    projectColumnDefs: snap.projectColumnDefs ?? [],
    changeSessions: (snap.changeSessions ?? []).filter(
      (s) =>
        s.humanAcceptance === "unreviewed" ||
        s.createdAt >= `${sessionOldestDay}T00:00:00.000+08:00` ||
        (s.day && s.day >= sessionOldestDay)
    ),
  });
}

/** 工作台只读 Studio 快照（请求内 memo） */
export async function getWorkbenchStudioSnapshot(): Promise<StudioSnapshot> {
  return memoizeDurableRead("studio-workbench", async () => {
    if (isSupabaseConfigured()) {
      try {
        return await readWorkbenchStudioFromSupabase();
      } catch {
        return capFromFull(await getStudioSnapshot());
      }
    }
    return capFromFull(await getStudioSnapshot());
  });
}
