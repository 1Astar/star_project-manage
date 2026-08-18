/**
 * PM 工作台「今日要做」：只验收「还没看过」的；已上版的免验
 */
import { readDb } from "@/lib/db/local-store";
import { getScopedStudioSnapshot } from "@/lib/demo/ensure-showcase";
import { isDemoPublicScope } from "@/lib/demo/scope";
import { isDemoShowcaseId } from "@/lib/demo/showcase";
import {
  requirementIsCancelled,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@/lib/types";
import { requirementLifecycleStatus } from "@/lib/requirement-status";
import { getTomorrowAgenda } from "@/lib/workbench/tomorrow-agenda";
import { memoizeDurableRead } from "@/lib/runtime/durable-read-memo";
import { projectLiveSiteUrl } from "@/lib/project-live-url";
import {
  findPmProjectForStudio,
  getStudioIdFromPmSlug,
} from "@/lib/project-bridge";
import {
  bundlePmAcceptanceItems,
  modulePathFromRequirement,
  normalizeModulePath,
  UNCATEGORIZED_MODULE,
  type PmAcceptanceBundle,
} from "@/lib/workbench/acceptance-bundles";

/** 变更会话回看（天） */
const SESSION_LOOKBACK_DAYS = 14;

/** PM slug → 路由用 Studio id（与 project-bridge 一致，避免同名双份） */
function routeIdForPmSlug(slug: string): string {
  return getStudioIdFromPmSlug(slug) ?? slug;
}

/** 演示沙盘下只允许 demo-showcase 的 PM 项目 id */
function demoPmProjectIds(
  projects: Array<{ id: string; slug: string }>
): Set<string> {
  return new Set(
    projects
      .filter((p) => isDemoShowcaseId(p.slug) || isDemoShowcaseId(p.id))
      .map((p) => p.id)
  );
}

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

function withinLookback(
  iso: string | null | undefined,
  todayDay: string,
  days: number
): boolean {
  if (!iso) return false;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : shanghaiDay(iso);
  const oldest = addShanghaiDays(todayDay, -(days - 1));
  return day >= oldest && day <= todayDay;
}

export type PmAcceptanceSource = "formal" | "change_session";

export type PmAcceptanceItem = {
  id: string;
  title: string;
  /** 路由用（常为 Studio id） */
  projectId: string;
  /** PM projects.id，建 Bug 用 */
  pmProjectId: string;
  projectTitle: string;
  href: string;
  /** 项目对外站点（demoUrl / vercelUrl） */
  liveSiteUrl?: string | null;
  source: PmAcceptanceSource;
  sourceLabel: string;
  requirementId?: string;
  changeSessionId?: string;
  note?: string;
  at: string;
  /** 板块路径（大·小）；缺省「未分板块」 */
  module: string;
  /** 为何做 */
  why: string;
  /** 实际结果 */
  result: string;
  /** 怎么验（checklist） */
  howToVerify: string[];
};

export type { PmAcceptanceBundle };

export type PmFollowUpItem = {
  id: string;
  title: string;
  projectId: string;
  projectTitle: string;
  href: string;
  kind: "blocker" | "yesterday_open" | "open_bug";
  kindLabel: string;
  note?: string;
};

export type PmOpenBugItem = {
  id: string;
  title: string;
  projectId: string;
  projectTitle: string;
  href: string;
  severity: number;
  statusLabel: string;
  note?: string;
};

const SOURCE_LABEL: Record<PmAcceptanceSource, string> = {
  formal: "正式待验",
  change_session: "变更会话",
};

const SOURCE_RANK: Record<PmAcceptanceSource, number> = {
  formal: 0,
  change_session: 1,
};

function hasProductPass(
  records: Array<{ requirement_id: string; passed: boolean }>,
  requirementId: string
): boolean {
  return records.some((r) => r.requirement_id === requirementId && r.passed === true);
}

/**
 * 待你验收（收紧）：
 * - 正式生命周期「待验收」且你还没点通过
 * - 近 N 天变更会话 humanAcceptance=unreviewed（你还没收口）
 * 展示时按「项目 × 板块」汇总（见 bundles）
 */
export async function getPmAcceptanceQueue(opts?: {
  todayDay?: string;
  /** 仅某 Studio 项目（发版门禁用） */
  projectId?: string;
}): Promise<{
  todayDay: string;
  lookbackDays: number;
  items: PmAcceptanceItem[];
  bundles: PmAcceptanceBundle[];
}> {
  const todayDay = opts?.todayDay ?? shanghaiDay();
  const key = `accept:${todayDay}:${opts?.projectId ?? "_"}`;
  return memoizeDurableRead(key, () => loadPmAcceptanceQueue({ ...opts, todayDay }));
}

async function loadPmAcceptanceQueue(opts?: {
  todayDay?: string;
  projectId?: string;
}): Promise<{
  todayDay: string;
  lookbackDays: number;
  items: PmAcceptanceItem[];
  bundles: PmAcceptanceBundle[];
}> {
  const todayDay = opts?.todayDay ?? shanghaiDay();
  const db = await readDb();
  const studio = await getScopedStudioSnapshot();
  const studioById = new Map(studio.projects.map((p) => [p.id, p]));
  const demoOnly = await isDemoPublicScope();
  const allowedPmIds = demoOnly ? demoPmProjectIds(db.projects) : null;
  const pmById = new Map(
    db.projects
      .filter((p) => !allowedPmIds || allowedPmIds.has(p.id))
      .map((p) => [p.id, p])
  );

  const items: PmAcceptanceItem[] = [];
  const seenReq = new Set<string>();

  for (const req of db.requirements) {
    if (allowedPmIds && !allowedPmIds.has(req.project_id)) continue;
    if (requirementIsCancelled(req)) continue;
    const life = requirementLifecycleStatus(req);
    if (life !== "待验收" && req.status !== "acceptance") continue;
    if (hasProductPass(db.acceptance_records, req.id)) continue;
    if (seenReq.has(req.id)) continue;
    seenReq.add(req.id);

    const pmProject = pmById.get(req.project_id);
    if (!pmProject) continue;
    const routeId = routeIdForPmSlug(pmProject.slug);
    if (opts?.projectId && routeId !== opts.projectId) continue;
    const projectTitle =
      studioById.get(routeId)?.title ?? pmProject.name ?? "未知项目";
    const studioProject = studioById.get(routeId);
    const module = modulePathFromRequirement(req, db.modules);
    const whyBits = [req.title, req.detail_work?.slice(0, 120)]
      .filter(Boolean)
      .join(" — ");
    const how =
      req.acceptance_criteria
        ?.split(/\n+/)
        .map((s) => s.replace(/^[-*•\d.\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 5) ?? [];
    items.push({
      id: `req:${req.id}`,
      title: req.title,
      projectId: routeId,
      pmProjectId: pmProject.id,
      projectTitle,
      href: `/projects/${routeId}/requirements/${req.id}`,
      liveSiteUrl: studioProject ? projectLiveSiteUrl(studioProject) : null,
      source: "formal",
      sourceLabel: SOURCE_LABEL.formal,
      requirementId: req.id,
      at: req.updated_at || todayDay,
      module,
      why: whyBits || req.title,
      result: req.next_step?.trim()
        ? `下一步曾写：${req.next_step.trim()}`
        : "正式需求待产品点通过",
      howToVerify: how,
    });
  }

  for (const session of studio.changeSessions ?? []) {
    if (session.humanAcceptance !== "unreviewed") continue;
    // 只收已收工或仍有未勾项的会话（纯进行中空会话不打扰）
    const finished = Boolean(session.finishedAt);
    const hasPending = (session.pendingItems?.length ?? 0) > 0;
    if (!finished && !hasPending) continue;

    const at = session.finishedAt || session.updatedAt || session.createdAt;
    const inWindow =
      withinLookback(at, todayDay, SESSION_LOOKBACK_DAYS) ||
      withinLookback(`${session.day}T12:00:00+08:00`, todayDay, SESSION_LOOKBACK_DAYS);
    if (!inWindow) continue;

    const project = studioById.get(session.projectId);
    if (!project || project.status === "archived") continue;
    if (opts?.projectId && project.id !== opts.projectId) continue;
    const pmProject = findPmProjectForStudio(project.id, [...pmById.values()]);
    if (!pmProject) continue;

    const module = normalizeModulePath(session.module);
    const why = [session.goal, session.reason].filter(Boolean).join(" — ") || session.goal;
    items.push({
      id: `chg:${session.id}`,
      title: session.goal || "变更会话待收口",
      projectId: project.id,
      pmProjectId: pmProject.id,
      projectTitle: project.title,
      href: `/projects/${project.id}/evolution`,
      liveSiteUrl: projectLiveSiteUrl(project),
      source: "change_session",
      sourceLabel: SOURCE_LABEL.change_session,
      changeSessionId: session.id,
      note: hasPending
        ? `未勾完 ${session.pendingItems!.length} 项`
        : module === UNCATEGORIZED_MODULE
          ? "缺板块 · 会话已收工"
          : "会话已收工，待你过目",
      at,
      module,
      why,
      result: session.result?.trim() || (hasPending ? "仍有未勾项" : "已收工待过目"),
      howToVerify: (session.expected ?? []).filter(Boolean).slice(0, 5),
    });
  }

  items.sort(
    (a, b) =>
      SOURCE_RANK[a.source] - SOURCE_RANK[b.source] || b.at.localeCompare(a.at)
  );

  const bundles = bundlePmAcceptanceItems(items);
  return { todayDay, lookbackDays: SESSION_LOOKBACK_DAYS, items, bundles };
}

export async function getPmFollowUps(opts?: {
  todayDay?: string;
}): Promise<{ todayDay: string; items: PmFollowUpItem[] }> {
  const todayDay = opts?.todayDay ?? shanghaiDay();
  return memoizeDurableRead(`follow:${todayDay}`, () => loadPmFollowUps({ todayDay }));
}

async function loadPmFollowUps(opts?: {
  todayDay?: string;
}): Promise<{ todayDay: string; items: PmFollowUpItem[] }> {
  const todayDay = opts?.todayDay ?? shanghaiDay();
  const studio = await getScopedStudioSnapshot();
  const studioById = new Map(studio.projects.map((p) => [p.id, p]));
  const items: PmFollowUpItem[] = [];
  const seen = new Set<string>();

  for (const t of studio.tasks) {
    if (!t.blocker?.trim() || t.status === "done") continue;
    const project = studioById.get(t.projectId);
    if (!project || project.status === "archived") continue;
    const id = `block:${t.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title: t.title,
      projectId: project.id,
      projectTitle: project.title,
      href: `/projects/${project.id}/tasks?view=studio`,
      kind: "blocker",
      kindLabel: "阻塞",
      note: t.blocker.trim(),
    });
  }

  const agenda = await getTomorrowAgenda({ todayDay });
  for (const a of agenda.items) {
    if (a.reason !== "yesterday_changed" && a.reason !== "change_session_pending") {
      continue;
    }
    const id = `follow:${a.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title: a.title,
      projectId: a.projectId,
      projectTitle: a.projectTitle,
      href: a.href,
      kind: "yesterday_open",
      kindLabel: a.reasonLabel,
      note: a.note,
    });
  }

  return { todayDay, items };
}

/** 全项目未关闭 Bug（工作台露出）；演示范围仅 demo-showcase */
export async function getOpenBugsAcrossProjects(): Promise<PmOpenBugItem[]> {
  return memoizeDurableRead("open-bugs", loadOpenBugsAcrossProjects);
}

async function loadOpenBugsAcrossProjects(): Promise<PmOpenBugItem[]> {
  const db = await readDb();
  const studio = await getScopedStudioSnapshot();
  const studioById = new Map(studio.projects.map((p) => [p.id, p]));
  const demoOnly = await isDemoPublicScope();
  const allowedPmIds = demoOnly ? demoPmProjectIds(db.projects) : null;
  const items: PmOpenBugItem[] = [];

  for (const bug of db.bugs) {
    if (bug.status === "done") continue;
    if (allowedPmIds && !allowedPmIds.has(bug.project_id)) continue;
    const pmProject = db.projects.find((p) => p.id === bug.project_id);
    if (!pmProject) continue;
    const routeId = routeIdForPmSlug(pmProject.slug);
    const projectTitle =
      studioById.get(routeId)?.title ?? pmProject.name ?? "未知项目";
    items.push({
      id: bug.id,
      title: bug.title,
      projectId: routeId,
      projectTitle,
      href: `/projects/${routeId}/bugs/${bug.id}`,
      severity: bug.severity,
      statusLabel: TASK_STATUS_LABELS[bug.status] ?? bug.status,
      note: bug.description?.slice(0, 80) || undefined,
    });
  }

  items.sort((a, b) => a.severity - b.severity || a.title.localeCompare(b.title, "zh-CN"));
  return items;
}

/** 明日清单在工作台只保留「到期=明天」，昨日未完进跟进栏 */
export function filterTomorrowDueOnly<T extends { reason: string }>(items: T[]): T[] {
  return items.filter((i) => i.reason === "due_tomorrow");
}

export function pmStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status] ?? status;
}

export { SESSION_LOOKBACK_DAYS as LOOKBACK_DAYS };
