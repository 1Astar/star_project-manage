import { getProjects, getProjectBundle, getPoolBundle } from "@/lib/db/local-store";
import { getScopedStudioSnapshot } from "@/lib/demo/ensure-showcase";
import { getStudioIdFromPmSlug } from "@/lib/project-bridge";
import { memoizeDurableRead } from "@/lib/runtime/durable-read-memo";
import {
  TASK_STATUS_LABELS as STUDIO_TASK_STATUS_LABELS,
  type TaskPriority,
} from "@/lib/studio/types";
import {
  TASK_STATUS_LABELS as PM_TASK_STATUS_LABELS,
  requirementIsCancelled,
  requirementIsDone,
  type TaskStatus as PmTaskStatus,
} from "@/lib/types";

export type TomorrowAgendaReason =
  | "yesterday_changed"
  | "change_session_pending"
  | "due_tomorrow";

export type TomorrowAgendaItem = {
  id: string;
  title: string;
  priority: TaskPriority | string;
  projectId: string;
  projectTitle: string;
  href: string;
  source: "pm_req" | "studio_task" | "change_session";
  reason: TomorrowAgendaReason;
  reasonLabel: string;
  statusLabel: string;
  note?: string;
};

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

function routeIdForPmSlug(slug: string): string {
  return getStudioIdFromPmSlug(slug) ?? slug;
}

function priorityRank(p: string | null | undefined) {
  if (p === "P0") return 0;
  if (p === "P1") return 1;
  if (p === "P2") return 2;
  if (p === "P3") return 3;
  return 4;
}

function reasonRank(r: TomorrowAgendaReason) {
  if (r === "yesterday_changed") return 0;
  if (r === "change_session_pending") return 1;
  return 2;
}

const REASON_LABELS: Record<TomorrowAgendaReason, string> = {
  yesterday_changed: "昨日变更 · 未完",
  change_session_pending: "昨日变更会话 · 未勾完",
  due_tomorrow: "到期 · 明天",
};

/** 上海日历日的起止（预留） */
export function shanghaiDayRange(day: string): { startIso: string; endIso: string } {
  const startIso = `${day}T00:00:00.000+08:00`;
  const endIso = `${day}T23:59:59.999+08:00`;
  return { startIso, endIso };
}

function inShanghaiDay(iso: string | null | undefined, day: string): boolean {
  if (!iso) return false;
  // due_date 常为 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso === day;
  return shanghaiDay(iso) === day;
}

/**
 * 明日待办清单（自动生成，非持久化）——只放「明天真要做」的，不是完整 backlog：
 * 1) 前一日有更新且未完成的 PM 需求（池+板）
 * 2) 前一日变更会话里 ❌ 未完成项
 * 3) 到期日 = 明天 的未完成 Studio 任务 / PM 需求
 * 不含：全部进行中/待办任务（那些留在「我的待办」其它区）
 */
export async function getTomorrowAgenda(opts?: {
  /** 基准「今天」的上海日；默认现在。清单对应「明天要看」= 以今天为参照看昨天变更 + 到期=明天 */
  todayDay?: string;
  projectId?: string | null;
}): Promise<{
  todayDay: string;
  yesterdayDay: string;
  tomorrowDay: string;
  items: TomorrowAgendaItem[];
  projects: Array<{ id: string; title: string }>;
}> {
  const todayDay = opts?.todayDay ?? shanghaiDay();
  const key = `tomorrow:${todayDay}:${opts?.projectId ?? "_"}`;
  return memoizeDurableRead(key, () => loadTomorrowAgenda({ ...opts, todayDay }));
}

async function loadTomorrowAgenda(opts?: {
  todayDay?: string;
  projectId?: string | null;
}): Promise<{
  todayDay: string;
  yesterdayDay: string;
  tomorrowDay: string;
  items: TomorrowAgendaItem[];
  projects: Array<{ id: string; title: string }>;
}> {
  const todayDay = opts?.todayDay ?? shanghaiDay();
  const yesterdayDay = addShanghaiDays(todayDay, -1);
  const tomorrowDay = addShanghaiDays(todayDay, 1);

  const studioSnap = await getScopedStudioSnapshot();
  const studioById = new Map(studioSnap.projects.map((p) => [p.id, p]));
  const items: TomorrowAgendaItem[] = [];
  const seen = new Set<string>();

  // —— 1+3) PM 需求：昨日更新未完，或到期=明天 ——
  const pmProjects = await getProjects();
  await Promise.all(
    pmProjects.map(async (pmProject) => {
      const [bundle, pool] = await Promise.all([
        getProjectBundle(pmProject.id),
        getPoolBundle(pmProject.id).catch(() => null),
      ]);
      const routeId = routeIdForPmSlug(pmProject.slug);
      const projectTitle = studioById.get(routeId)?.title ?? pmProject.name;
      const reqs = [
        ...(bundle?.requirements ?? []),
        ...(pool?.poolRequirements ?? []),
      ];
      const byId = new Map(reqs.map((r) => [r.id, r]));

      for (const req of byId.values()) {
        if (requirementIsDone(req) || requirementIsCancelled(req)) continue;
        const yesterdayHit = inShanghaiDay(req.updated_at, yesterdayDay);
        const dueHit = inShanghaiDay(req.due_date, tomorrowDay);
        if (!yesterdayHit && !dueHit) continue;

        const id = `pm:${req.id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const reason: TomorrowAgendaReason = yesterdayHit
          ? "yesterday_changed"
          : "due_tomorrow";
        items.push({
          id,
          title: req.title,
          priority: req.priority || "P2",
          projectId: routeId,
          projectTitle,
          href: `/projects/${routeId}/tasks?req=${req.id}`,
          source: "pm_req",
          reason,
          reasonLabel: REASON_LABELS[reason],
          statusLabel: PM_TASK_STATUS_LABELS[req.status as PmTaskStatus] ?? req.status,
        });
      }
    })
  );

  // —— 2) 昨日变更会话 pendingItems ——
  for (const session of studioSnap.changeSessions ?? []) {
    if (session.day !== yesterdayDay && !inShanghaiDay(session.updatedAt, yesterdayDay)) {
      continue;
    }
    if (!session.pendingItems?.length) continue;
    const project = studioById.get(session.projectId);
    if (!project || project.status === "archived") continue;
    for (let i = 0; i < session.pendingItems.length; i++) {
      const pending = session.pendingItems[i];
      const id = `chg:${session.id}:${i}`;
      if (seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        title: pending,
        priority: "P1",
        projectId: project.id,
        projectTitle: project.title,
        href: `/projects/${project.id}/evolution`,
        source: "change_session",
        reason: "change_session_pending",
        reasonLabel: REASON_LABELS.change_session_pending,
        statusLabel: "未完成项",
        note: `来自变更：${session.goal}`,
      });
    }
  }

  // —— 3) Studio 任务：仅到期日 = 明天 ——
  for (const task of studioSnap.tasks) {
    if (task.status === "done") continue;
    if (!inShanghaiDay(task.dueDate, tomorrowDay)) continue;
    const project = studioById.get(task.projectId);
    if (!project || project.status === "archived") continue;
    const id = `st:${task.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    items.push({
      id,
      title: task.title,
      priority: task.priority,
      projectId: project.id,
      projectTitle: project.title,
      href: `/projects/${project.id}/tasks?view=studio`,
      source: "studio_task",
      reason: "due_tomorrow",
      reasonLabel: REASON_LABELS.due_tomorrow,
      statusLabel: STUDIO_TASK_STATUS_LABELS[task.status] ?? task.status,
      note: task.progressNote?.trim() || undefined,
    });
  }

  let filtered = items;
  if (opts?.projectId) {
    filtered = items.filter((i) => i.projectId === opts.projectId);
  }

  filtered.sort(
    (a, b) =>
      reasonRank(a.reason) - reasonRank(b.reason) ||
      priorityRank(a.priority) - priorityRank(b.priority) ||
      a.title.localeCompare(b.title, "zh-CN")
  );

  const projectMap = new Map<string, string>();
  for (const i of filtered) projectMap.set(i.projectId, i.projectTitle);
  const projects = [...projectMap.entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));

  return { todayDay, yesterdayDay, tomorrowDay, items: filtered, projects };
}
