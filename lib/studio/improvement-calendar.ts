import type { ChangeSession, EvolutionLog } from "@/lib/studio/types";

export type ImprovementDayItem = {
  id: string;
  kind: "evolution" | "change";
  title: string;
  projectId: string;
  projectTitle: string;
  module: string;
  at: string;
  day: string;
};

export type ImprovementDayBucket = {
  day: string;
  items: ImprovementDayItem[];
  projectTitles: string[];
  modules: string[];
};

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/** 按日聚合演进 + 变更会话（跨项目） */
export function buildImprovementCalendar(input: {
  evolution: EvolutionLog[];
  changeSessions: ChangeSession[];
  projectTitleById: Map<string, string>;
}): Map<string, ImprovementDayBucket> {
  const items: ImprovementDayItem[] = [];

  for (const log of input.evolution) {
    const at = log.createdAt;
    items.push({
      id: log.id,
      kind: "evolution",
      title: log.title,
      projectId: log.projectId,
      projectTitle: input.projectTitleById.get(log.projectId) ?? log.projectId,
      module: (log.module || "").trim(),
      at,
      day: dayOf(at),
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
    });
  }

  const map = new Map<string, ImprovementDayBucket>();
  for (const item of items) {
    let bucket = map.get(item.day);
    if (!bucket) {
      bucket = { day: item.day, items: [], projectTitles: [], modules: [] };
      map.set(item.day, bucket);
    }
    bucket.items.push(item);
  }

  for (const bucket of map.values()) {
    bucket.items.sort((a, b) => b.at.localeCompare(a.at));
    bucket.projectTitles = Array.from(
      new Set(bucket.items.map((i) => i.projectTitle))
    ).sort((a, b) => a.localeCompare(b, "zh-CN"));
    bucket.modules = Array.from(
      new Set(bucket.items.map((i) => i.module).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "zh-CN"));
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
