import type { ChangeSession, EvolutionLog } from "@/lib/studio/types";

export type ImprovementDayItem = {
  id: string;
  kind: "evolution" | "change" | "release";
  title: string;
  projectId: string;
  projectTitle: string;
  module: string;
  at: string;
  day: string;
  releaseTag?: string | null;
};

export type ImprovementDayProjectGroup = {
  projectId: string;
  projectTitle: string;
  /** 该日该项目的板块/方向 */
  directions: string[];
  items: ImprovementDayItem[];
  releaseCount: number;
  changeCount: number;
};

export type ImprovementDaySummary = {
  projectCount: number;
  changeCount: number;
  /** 当日挂到版本/上版的条目数（按 releaseTag，不是补标完成需求） */
  releaseCount: number;
  releaseTags: string[];
  /** 主要改进方向（板块频次前几） */
  mainDirections: string[];
};

export type ImprovementDayBucket = {
  day: string;
  items: ImprovementDayItem[];
  projectTitles: string[];
  modules: string[];
  summary: ImprovementDaySummary;
  byProject: ImprovementDayProjectGroup[];
};

function dayOf(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return iso.slice(0, 10);
}

function buildSummaryAndGroups(items: ImprovementDayItem[]): {
  summary: ImprovementDaySummary;
  byProject: ImprovementDayProjectGroup[];
  projectTitles: string[];
  modules: string[];
} {
  const moduleCount = new Map<string, number>();
  for (const item of items) {
    const m = item.module.trim();
    if (!m) continue;
    moduleCount.set(m, (moduleCount.get(m) ?? 0) + 1);
  }
  const mainDirections = [...moduleCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, 5)
    .map(([m]) => m);

  const groupMap = new Map<string, ImprovementDayProjectGroup>();
  for (const item of items) {
    let g = groupMap.get(item.projectId);
    if (!g) {
      g = {
        projectId: item.projectId,
        projectTitle: item.projectTitle,
        directions: [],
        items: [],
        releaseCount: 0,
        changeCount: 0,
      };
      groupMap.set(item.projectId, g);
    }
    g.items.push(item);
    if (item.kind === "release" || item.releaseTag) g.releaseCount += 1;
    else g.changeCount += 1;
  }

  const byProject = [...groupMap.values()]
    .map((g) => {
      const dirs = [
        ...new Set(g.items.map((i) => i.module.trim()).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b, "zh-CN"));
      g.directions = dirs;
      g.items.sort((a, b) => b.at.localeCompare(a.at));
      return g;
    })
    .sort((a, b) => a.projectTitle.localeCompare(b.projectTitle, "zh-CN"));

  const projectTitles = byProject.map((g) => g.projectTitle);
  const modules = [...new Set(items.map((i) => i.module.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "zh-CN")
  );

  const releaseTags = [
    ...new Set(items.map((i) => i.releaseTag).filter(Boolean) as string[]),
  ].sort();

  return {
    summary: {
      projectCount: byProject.length,
      changeCount: items.filter((i) => i.kind === "evolution" || i.kind === "change").length,
      releaseCount: releaseTags.length,
      releaseTags,
      mainDirections,
    },
    byProject,
    projectTitles,
    modules,
  };
}

/** 按日聚合演进 + 变更会话（跨项目）→ 每日总结；「上版」= 当日条目的 releaseTag */
export function buildImprovementCalendar(input: {
  evolution: EvolutionLog[];
  changeSessions: ChangeSession[];
  projectTitleById: Map<string, string>;
}): Map<string, ImprovementDayBucket> {
  const items: ImprovementDayItem[] = [];

  for (const log of input.evolution) {
    const at = log.createdAt;
    const tag = log.releaseTag?.trim() || null;
    items.push({
      id: log.id,
      kind: tag ? "release" : "evolution",
      title: log.title,
      projectId: log.projectId,
      projectTitle: input.projectTitleById.get(log.projectId) ?? log.projectId,
      module: (log.module || "").trim(),
      at,
      day: dayOf(at),
      releaseTag: tag,
    });
  }

  for (const s of input.changeSessions) {
    const at = s.finishedAt || s.createdAt;
    items.push({
      id: s.id,
      kind: "change",
      title: s.goal || "变更会话",
      projectId: s.projectId,
      projectTitle: input.projectTitleById.get(s.projectId) ?? s.projectId,
      module: (s.module || "").trim(),
      at,
      day: s.day || dayOf(at),
      releaseTag: null,
    });
  }

  const map = new Map<string, ImprovementDayBucket>();
  for (const item of items) {
    let bucket = map.get(item.day);
    if (!bucket) {
      bucket = {
        day: item.day,
        items: [],
        projectTitles: [],
        modules: [],
        summary: {
          projectCount: 0,
          changeCount: 0,
          releaseCount: 0,
          releaseTags: [],
          mainDirections: [],
        },
        byProject: [],
      };
      map.set(item.day, bucket);
    }
    bucket.items.push(item);
  }

  for (const bucket of map.values()) {
    bucket.items.sort((a, b) => b.at.localeCompare(a.at));
    const built = buildSummaryAndGroups(bucket.items);
    bucket.summary = built.summary;
    bucket.byProject = built.byProject;
    bucket.projectTitles = built.projectTitles;
    bucket.modules = built.modules;
  }

  return map;
}

export function monthDays(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay(); // 0 Sun
  const days: Date[] = [];
  for (let i = 0; i < startPad; i += 1) {
    const d = new Date(year, monthIndex, 1 - (startPad - i));
    days.push(d);
  }
  const lastDate = new Date(year, monthIndex + 1, 0).getDate();
  for (let d = 1; d <= lastDate; d += 1) {
    days.push(new Date(year, monthIndex, d));
  }
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1]!;
    days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  return days;
}

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
