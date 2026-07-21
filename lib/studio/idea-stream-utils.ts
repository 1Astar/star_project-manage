import type { Idea, IdeaType } from "@/lib/studio/types";

export const IDEA_TYPE_EMOJI: Record<IdeaType, string> = {
  product: "💡",
  feature: "⚡",
  ui: "🎨",
  content: "📝",
  tech: "🔧",
  business: "💰",
};

export type IdeaDateGroup = "today" | "yesterday" | "earlier";

export const IDEA_DATE_GROUP_LABELS: Record<IdeaDateGroup, string> = {
  today: "今日",
  yesterday: "昨日",
  earlier: "更早",
};

const TZ = "Asia/Shanghai";

function dateKeyInTz(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** 时间线用：灵感发生时间，缺省回退入库时间 */
export function ideaOccurredAt(idea: Pick<Idea, "occurredAt" | "createdAt">): string {
  return idea.occurredAt || idea.createdAt;
}

export function getIdeaDateGroup(iso: string, now = new Date()): IdeaDateGroup {
  const ideaDay = dateKeyInTz(iso);
  const today = dateKeyInTz(now.toISOString());
  if (ideaDay === today) return "today";

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = dateKeyInTz(yesterdayDate.toISOString());
  if (ideaDay === yesterday) return "yesterday";

  return "earlier";
}

export function formatIdeaTime(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatIdeaDateTime(iso: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function groupIdeasByDate(ideas: Idea[]): Record<IdeaDateGroup, Idea[]> {
  const groups: Record<IdeaDateGroup, Idea[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  const sorted = [...ideas].sort((a, b) =>
    ideaOccurredAt(b).localeCompare(ideaOccurredAt(a))
  );
  for (const idea of sorted) {
    groups[getIdeaDateGroup(ideaOccurredAt(idea))].push(idea);
  }
  return groups;
}

export function isIdeaOnDate(
  ideaOrIso: Idea | string,
  date: "today" | string,
  now = new Date()
): boolean {
  const iso = typeof ideaOrIso === "string" ? ideaOrIso : ideaOccurredAt(ideaOrIso);
  if (date === "today") {
    return getIdeaDateGroup(iso, now) === "today";
  }
  return dateKeyInTz(iso) === date;
}

export function ideaSummaryLine(idea: Idea): string {
  const line = idea.oneLineIdea?.trim() || idea.whyItMatters?.trim() || idea.rawInput?.trim();
  if (!line) return "—";
  return line.length > 80 ? `${line.slice(0, 80)}…` : line;
}

/** datetime-local 控件值 ↔ ISO */
export function toDatetimeLocalValue(iso: string, now = new Date()): string {
  const d = new Date(iso || now.toISOString());
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function fromDatetimeLocalValue(local: string): string | null {
  const trimmed = local.trim();
  if (!trimmed) return null;
  const asShanghai = new Date(`${trimmed}:00+08:00`);
  if (Number.isNaN(asShanghai.getTime())) return null;
  return asShanghai.toISOString();
}
