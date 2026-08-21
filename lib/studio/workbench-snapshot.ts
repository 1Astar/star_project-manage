/**
 * 工作台专用 Studio 快照：列裁剪 + 时间窗，避免 select * 大字段拖垮 Worker（1102）。
 * 项目详情页走 project-scoped-read（按项目查），勿再默认全量 getStudioSnapshot。
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
import type {
  ChangeSession,
  EvolutionLog,
  Idea,
  Project,
  StudioTask,
} from "@/lib/studio/types";

/** 星图灵感条数上限（首页 SSR） */
export const WORKBENCH_IDEA_LIMIT = 80;
/** 改进日历：演进回看天数 */
export const WORKBENCH_EVOLUTION_DAYS = 45;
/** 改进日历 / 明日议程：变更会话回看天数 */
export const WORKBENCH_SESSION_DAYS = 45;
/** 演进条数上限 */
export const WORKBENCH_EVOLUTION_LIMIT = 120;
/** 日历用近期会话上限 */
export const WORKBENCH_SESSION_CALENDAR_LIMIT = 100;
/** 待验收 unreviewed 会话上限（另按 14 天窗过滤） */
export const WORKBENCH_SESSION_UNREVIEWED_LIMIT = 60;
/** 待验收会话回看天数（与 pm-inbox SESSION_LOOKBACK 对齐） */
export const WORKBENCH_ACCEPT_SESSION_DAYS = 14;
/** 未完成任务上限（主线/阻塞/下一步草稿） */
export const WORKBENCH_OPEN_TASK_LIMIT = 200;

const WORKBENCH_PROJECT_COLUMNS = [
  "id",
  "title",
  "positioning",
  "target_user",
  "status",
  "priority",
  "current_stage",
  "next_action",
  "demo_url",
  "code_path",
  "github_repo",
  "github_branch",
  "vercel_url",
  "related_page_url",
  "parent_id",
  "feature_modules",
  "created_at",
  "updated_at",
].join(",");

const WORKBENCH_IDEA_COLUMNS = [
  "id",
  "title",
  "one_line_idea",
  "status",
  "type",
  "priority",
  "related_project_id",
  "related_module",
  "created_at",
].join(",");

const WORKBENCH_EVOLUTION_COLUMNS = [
  "id",
  "title",
  "project_id",
  "log_type",
  "decision",
  "module",
  "release_tag",
  "created_at",
].join(",");

/** 日历 + 待验：不要 ai_ops（常为超长数组） */
const WORKBENCH_SESSION_COLUMNS = [
  "id",
  "project_id",
  "day",
  "goal",
  "reason",
  "expected",
  "done_items",
  "pending_items",
  "result",
  "human_acceptance",
  "module",
  "requirement_id",
  "idea_id",
  "status",
  "created_at",
  "updated_at",
  "finished_at",
].join(",");

const WORKBENCH_TASK_COLUMNS = [
  "id",
  "title",
  "project_id",
  "status",
  "priority",
  "blocker",
  "due_date",
  "created_at",
].join(",");

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

function clipText(value: unknown, max: number): string {
  if (value == null) return "";
  const s = String(value);
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function clipList(value: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((v) => clipText(v, maxItemLen))
    .filter(Boolean);
}

async function loadOrdered<T>(
  table: string,
  opts: {
    columns?: string;
    order?: { column: string; ascending: boolean };
    eq?: { column: string; value: string };
    gte?: { column: string; value: string };
    or?: string;
    limit?: number;
  } = {}
): Promise<T[]> {
  let query = sb().from(table).select(opts.columns ?? "*");
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

function mapWorkbenchProject(row: Partial<StudioProjectRow>): Project {
  const project = rowToProject({
    positioning: "",
    target_user: "",
    priority: "P2",
    current_stage: "",
    next_action: "",
    demo_url: null,
    local_run_guide: null,
    code_path: null,
    github_repo: null,
    vercel_url: null,
    last_commit_message: null,
    last_commit_at: null,
    related_page_url: null,
    portfolio_value: "",
    body: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...row,
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    status: String(row.status ?? "todo"),
  } as StudioProjectRow);
  project.positioning = clipText(project.positioning, 180);
  project.nextAction = clipText(project.nextAction, 120);
  project.localRunGuide = null;
  project.portfolioValue = "";
  project.body = {
    ...project.body,
    initialThought: "",
    whyThought: "",
    positioning: "",
    iterations: "",
    done: "",
    notDone: "",
    nextStep: clipText(project.body?.nextStep || project.nextAction, 120),
    links: "",
    retrospectives: "",
  };
  return project;
}

function mapWorkbenchIdea(row: Partial<StudioIdeaRow>): Idea {
  const idea = rowToIdea({
    one_line_idea: "",
    why_it_matters: "",
    trigger_source: "",
    emotion_level: "normal",
    type: "feature",
    priority: "P2",
    raw_input: "",
    related_project_id: null,
    related_idea_id: null,
    subtasks: [],
    status: "inbox",
    suggested_next_step: "",
    github_issue_number: null,
    github_issue_url: null,
    github_labels: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...row,
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
  } as StudioIdeaRow);
  idea.oneLineIdea = clipText(idea.oneLineIdea, 120);
  idea.rawInput = "";
  idea.aiSupplement = "";
  idea.whyItMatters = "";
  idea.sourceChat = "";
  idea.decisionNotes = "";
  idea.evolutionNotes = "";
  idea.relatedAssetsNote = "";
  idea.subtasks = [];
  return idea;
}

function mapWorkbenchEvolution(row: Partial<StudioEvolutionRow>): EvolutionLog {
  const log = rowToEvolution({
    title: "",
    project_id: "",
    log_type: "decision",
    before_text: "",
    after_text: "",
    reason: "",
    decision: "",
    created_at: new Date().toISOString(),
    ...row,
    id: String(row.id ?? ""),
  } as StudioEvolutionRow);
  log.title = clipText(log.title, 120);
  log.decision = clipText(log.decision, 160);
  log.before = "";
  log.after = "";
  log.reason = "";
  return log;
}

function mapWorkbenchSession(row: Partial<StudioChangeSessionRow>): ChangeSession {
  const session = rowToChangeSession({
    project_id: "",
    day: shanghaiDay(),
    goal: "",
    reason: "",
    expected: [],
    done_items: [],
    pending_items: [],
    ai_ops: [],
    result: "",
    human_acceptance: "unreviewed",
    status: "open",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...row,
    id: String(row.id ?? ""),
  } as StudioChangeSessionRow);
  session.goal = clipText(session.goal, 160);
  session.reason = clipText(session.reason, 160);
  session.result = clipText(session.result, 240);
  session.expected = clipList(session.expected, 8, 120);
  session.doneItems = clipList(session.doneItems, 8, 120);
  session.pendingItems = clipList(session.pendingItems, 8, 120);
  session.aiOps = [];
  return session;
}

function mapWorkbenchTask(row: Partial<StudioTaskRow>): StudioTask {
  const task = rowToTask({
    title: "",
    project_id: "",
    status: "todo",
    priority: "P2",
    workload: "",
    blocker: null,
    due_date: null,
    created_at: new Date().toISOString(),
    ...row,
    id: String(row.id ?? ""),
  } as StudioTaskRow);
  task.title = clipText(task.title, 120);
  task.blocker = task.blocker ? clipText(task.blocker, 160) : null;
  task.workload = "";
  task.progressNote = "";
  task.gitCommitMessage = null;
  return task;
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
    loadOrdered<Partial<StudioProjectRow>>("studio_projects", {
      columns: WORKBENCH_PROJECT_COLUMNS,
      eq: { column: "id", value: id },
    }),
    loadOrdered<Partial<StudioIdeaRow>>("studio_ideas", {
      columns: WORKBENCH_IDEA_COLUMNS,
      eq: { column: "related_project_id", value: id },
      order: { column: "created_at", ascending: false },
      limit: 50,
    }),
    loadOrdered<Partial<StudioEvolutionRow>>("studio_evolution_logs", {
      columns: WORKBENCH_EVOLUTION_COLUMNS,
      eq: { column: "project_id", value: id },
      order: { column: "created_at", ascending: false },
      limit: 50,
    }),
    loadOrdered<Partial<StudioTaskRow>>("studio_tasks", {
      columns: WORKBENCH_TASK_COLUMNS,
      eq: { column: "project_id", value: id },
      limit: 80,
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
    loadOrdered<Partial<StudioChangeSessionRow>>("studio_change_sessions", {
      columns: WORKBENCH_SESSION_COLUMNS,
      eq: { column: "project_id", value: id },
      order: { column: "created_at", ascending: false },
      limit: 50,
    }),
  ]);

  return normalize({
    projects: projectRows.map(mapWorkbenchProject),
    ideas: ideaRows.map(mapWorkbenchIdea),
    evolutionLogs: evolutionRows.map(mapWorkbenchEvolution),
    tasks: taskRows.map(mapWorkbenchTask),
    assets: assetRows.map(rowToAsset),
    releases: releaseRows.map(rowToRelease),
    projectColumnDefs: [],
    changeSessions: changeSessionRows.map(mapWorkbenchSession),
  });
}

/** 登录工作台：项目轻量列；任务仅未完成；灵感/演进/会话按窗口裁剪；资源/发版不拉 */
async function readWorkbenchStudioFromSupabase(): Promise<StudioSnapshot> {
  const evoSince = daysAgoIso(WORKBENCH_EVOLUTION_DAYS);
  const sessionSince = daysAgoIso(WORKBENCH_SESSION_DAYS);
  const acceptSince = daysAgoIso(WORKBENCH_ACCEPT_SESSION_DAYS);
  const acceptDay = addShanghaiDays(shanghaiDay(), -(WORKBENCH_ACCEPT_SESSION_DAYS - 1));

  const [
    projectRows,
    ideaRows,
    evolutionRows,
    taskRows,
    columnRows,
    calendarSessions,
    unreviewedSessions,
  ] = await Promise.all([
    loadOrdered<Partial<StudioProjectRow>>("studio_projects", {
      columns: WORKBENCH_PROJECT_COLUMNS,
      order: { column: "updated_at", ascending: false },
    }),
    loadOrdered<Partial<StudioIdeaRow>>("studio_ideas", {
      columns: WORKBENCH_IDEA_COLUMNS,
      order: { column: "created_at", ascending: false },
      limit: WORKBENCH_IDEA_LIMIT,
    }),
    loadOrdered<Partial<StudioEvolutionRow>>("studio_evolution_logs", {
      columns: WORKBENCH_EVOLUTION_COLUMNS,
      gte: { column: "created_at", value: evoSince },
      order: { column: "created_at", ascending: false },
      limit: WORKBENCH_EVOLUTION_LIMIT,
    }),
    (async () => {
      const { data, error } = await sb()
        .from("studio_tasks")
        .select(WORKBENCH_TASK_COLUMNS)
        .neq("status", "done")
        .order("created_at", { ascending: false })
        .limit(WORKBENCH_OPEN_TASK_LIMIT);
      if (error) {
        if (error.message.includes("studio_tasks")) return [] as Partial<StudioTaskRow>[];
        throw new Error(`studio_tasks: ${error.message}`);
      }
      return (data ?? []) as Partial<StudioTaskRow>[];
    })(),
    loadOrdered<StudioProjectColumnDefRow>("studio_project_column_defs", {
      order: { column: "sort_order", ascending: true },
    }),
    loadOrdered<Partial<StudioChangeSessionRow>>("studio_change_sessions", {
      columns: WORKBENCH_SESSION_COLUMNS,
      gte: { column: "created_at", value: sessionSince },
      order: { column: "created_at", ascending: false },
      limit: WORKBENCH_SESSION_CALENDAR_LIMIT,
    }),
    loadOrdered<Partial<StudioChangeSessionRow>>("studio_change_sessions", {
      columns: WORKBENCH_SESSION_COLUMNS,
      eq: { column: "human_acceptance", value: "unreviewed" },
      or: `finished_at.gte.${acceptSince},created_at.gte.${acceptSince},day.gte.${acceptDay}`,
      order: { column: "created_at", ascending: false },
      limit: WORKBENCH_SESSION_UNREVIEWED_LIMIT,
    }),
  ]);

  const sessionById = new Map<string, Partial<StudioChangeSessionRow>>();
  for (const row of [...calendarSessions, ...unreviewedSessions]) {
    if (row.id) sessionById.set(String(row.id), row);
  }

  return normalize({
    projects: projectRows.map(mapWorkbenchProject),
    ideas: ideaRows.map(mapWorkbenchIdea),
    evolutionLogs: evolutionRows.map(mapWorkbenchEvolution),
    tasks: taskRows.map(mapWorkbenchTask),
    assets: [],
    releases: [],
    projectColumnDefs: columnRows.map(rowToColumnDef),
    changeSessions: [...sessionById.values()].map(mapWorkbenchSession),
  });
}

function capFromFull(snap: StudioSnapshot): StudioSnapshot {
  const evoOldest = daysAgoIso(WORKBENCH_EVOLUTION_DAYS);
  const sessionOldestDay = addShanghaiDays(shanghaiDay(), -(WORKBENCH_SESSION_DAYS - 1));
  const acceptOldestDay = addShanghaiDays(
    shanghaiDay(),
    -(WORKBENCH_ACCEPT_SESSION_DAYS - 1)
  );
  const recentSessions = (snap.changeSessions ?? []).filter(
    (s) =>
      s.createdAt >= `${sessionOldestDay}T00:00:00.000+08:00` ||
      (s.day && s.day >= sessionOldestDay)
  );
  const unreviewed = (snap.changeSessions ?? []).filter(
    (s) =>
      s.humanAcceptance === "unreviewed" &&
      (s.finishedAt || s.updatedAt || s.createdAt || `${s.day}T12:00:00+08:00`) >=
        `${acceptOldestDay}T00:00:00.000+08:00`
  );
  const sessionById = new Map<string, (typeof recentSessions)[number]>();
  for (const s of [
    ...recentSessions.slice(0, WORKBENCH_SESSION_CALENDAR_LIMIT),
    ...unreviewed.slice(0, WORKBENCH_SESSION_UNREVIEWED_LIMIT),
  ]) {
    sessionById.set(s.id, s);
  }
  return normalize({
    projects: snap.projects.map((p) =>
      mapWorkbenchProject({
        id: p.id,
        title: p.title,
        positioning: p.positioning,
        target_user: p.targetUser,
        status: p.status,
        priority: p.priority,
        current_stage: p.currentStage,
        next_action: p.nextAction,
        demo_url: p.demoUrl,
        code_path: p.codePath,
        github_repo: p.githubRepo,
        github_branch: p.githubBranch,
        vercel_url: p.vercelUrl,
        related_page_url: p.relatedPageUrl,
        parent_id: p.parentId,
        feature_modules: p.featureModules,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      })
    ),
    ideas: [...snap.ideas]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, WORKBENCH_IDEA_LIMIT)
      .map((idea) =>
        mapWorkbenchIdea({
          id: idea.id,
          title: idea.title,
          one_line_idea: idea.oneLineIdea,
          status: idea.status,
          type: idea.type,
          priority: idea.priority,
          related_project_id: idea.relatedProjectId,
          related_module: idea.relatedModule,
          created_at: idea.createdAt,
        })
      ),
    evolutionLogs: snap.evolutionLogs
      .filter((e) => e.createdAt >= evoOldest)
      .slice(0, WORKBENCH_EVOLUTION_LIMIT)
      .map((e) =>
        mapWorkbenchEvolution({
          id: e.id,
          title: e.title,
          project_id: e.projectId,
          log_type: e.logType,
          decision: e.decision,
          module: e.module,
          release_tag: e.releaseTag,
          created_at: e.createdAt,
        })
      ),
    tasks: snap.tasks
      .filter((t) => t.status !== "done")
      .slice(0, WORKBENCH_OPEN_TASK_LIMIT)
      .map((t) =>
        mapWorkbenchTask({
          id: t.id,
          title: t.title,
          project_id: t.projectId,
          status: t.status,
          priority: t.priority,
          blocker: t.blocker,
          due_date: t.dueDate,
        })
      ),
    assets: [],
    releases: [],
    projectColumnDefs: snap.projectColumnDefs ?? [],
    changeSessions: [...sessionById.values()].map((s) =>
      mapWorkbenchSession({
        id: s.id,
        project_id: s.projectId,
        day: s.day,
        goal: s.goal,
        reason: s.reason,
        expected: s.expected,
        done_items: s.doneItems,
        pending_items: s.pendingItems,
        result: s.result,
        human_acceptance: s.humanAcceptance,
        module: s.module,
        requirement_id: s.requirementId,
        idea_id: s.ideaId,
        status: s.status,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
        finished_at: s.finishedAt,
      })
    ),
  });
}

/** 轻量失败兜底：只拉项目行，避免再走全库 getStudioSnapshot 二次爆炸 */
async function emergencyProjectsOnly(): Promise<StudioSnapshot> {
  try {
    const projectRows = await loadOrdered<Partial<StudioProjectRow>>("studio_projects", {
      columns: WORKBENCH_PROJECT_COLUMNS,
      order: { column: "updated_at", ascending: false },
      limit: 80,
    });
    return normalize({
      projects: projectRows.map(mapWorkbenchProject),
      ideas: [],
      evolutionLogs: [],
      tasks: [],
      assets: [],
      releases: [],
      projectColumnDefs: [],
      changeSessions: [],
    });
  } catch {
    return normalize({
      projects: [],
      ideas: [],
      evolutionLogs: [],
      tasks: [],
      assets: [],
      releases: [],
      projectColumnDefs: [],
      changeSessions: [],
    });
  }
}

/** 工作台只读 Studio 快照（请求内 memo） */
export async function getWorkbenchStudioSnapshot(): Promise<StudioSnapshot> {
  return memoizeDurableRead("studio-workbench", async () => {
    if (isSupabaseConfigured()) {
      try {
        return await readWorkbenchStudioFromSupabase();
      } catch (e) {
        console.error("workbench studio slim failed", e);
        try {
          return await emergencyProjectsOnly();
        } catch {
          return capFromFull(await getStudioSnapshot());
        }
      }
    }
    return capFromFull(await getStudioSnapshot());
  });
}
