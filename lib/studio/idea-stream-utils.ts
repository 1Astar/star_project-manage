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

export function getIdeaDateGroup(createdAt: string, now = new Date()): IdeaDateGroup {
  const ideaDay = dateKeyInTz(createdAt);
  const today = dateKeyInTz(now.toISOString());
  if (ideaDay === today) return "today";

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = dateKeyInTz(yesterdayDate.toISOString());
  if (ideaDay === yesterday) return "yesterday";

  return "earlier";
}

export function formatIdeaTime(createdAt: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(createdAt));
}

export function groupIdeasByDate(ideas: Idea[]): Record<IdeaDateGroup, Idea[]> {
  const groups: Record<IdeaDateGroup, Idea[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  const sorted = [...ideas].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const idea of sorted) {
    groups[getIdeaDateGroup(idea.createdAt)].push(idea);
  }
  return groups;
}

export function isIdeaOnDate(createdAt: string, date: "today" | string, now = new Date()): boolean {
  if (date === "today") {
    return getIdeaDateGroup(createdAt, now) === "today";
  }
  return dateKeyInTz(createdAt) === date;
}

export function ideaSummaryLine(idea: Idea): string {
  const line = idea.oneLineIdea?.trim() || idea.whyItMatters?.trim() || idea.rawInput?.trim();
  if (!line) return "—";
  return line.length > 80 ? `${line.slice(0, 80)}…` : line;
}
