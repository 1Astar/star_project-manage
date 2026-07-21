export const REQ_BOARD_VIEWS_KEY = "star-pm:req-board-views-v1";

export type ReqBoardFilters = {
  projectId: string;
  /** 空 = 不限状态 */
  statuses: string[];
  /** 空 = 不限优先级 */
  priorities: string[];
  hideDone: boolean;
  query: string;
};

export type ReqBoardSavedView = {
  id: string;
  name: string;
  filters: ReqBoardFilters;
};

export type ReqBoardViewsState = {
  views: ReqBoardSavedView[];
  activeViewId: string | null;
};

export const DEFAULT_REQ_BOARD_FILTERS: ReqBoardFilters = {
  projectId: "",
  statuses: [],
  priorities: [],
  hideDone: true,
  query: "",
};

export function parseReqBoardFilters(raw: unknown): ReqBoardFilters {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_REQ_BOARD_FILTERS };
  const o = raw as Record<string, unknown>;
  return {
    projectId: typeof o.projectId === "string" ? o.projectId : "",
    statuses: Array.isArray(o.statuses)
      ? o.statuses.filter((s): s is string => typeof s === "string")
      : [],
    priorities: Array.isArray(o.priorities)
      ? o.priorities.filter((s): s is string => typeof s === "string")
      : [],
    hideDone: typeof o.hideDone === "boolean" ? o.hideDone : true,
    query: typeof o.query === "string" ? o.query : "",
  };
}

export function readReqBoardViewsState(): ReqBoardViewsState {
  if (typeof window === "undefined") return { views: [], activeViewId: null };
  try {
    const raw = window.localStorage.getItem(REQ_BOARD_VIEWS_KEY);
    if (!raw) return { views: [], activeViewId: null };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const views = Array.isArray(parsed.views)
      ? parsed.views
          .map((v) => {
            if (!v || typeof v !== "object") return null;
            const row = v as Record<string, unknown>;
            if (typeof row.id !== "string" || typeof row.name !== "string") return null;
            return {
              id: row.id,
              name: row.name,
              filters: parseReqBoardFilters(row.filters),
            } satisfies ReqBoardSavedView;
          })
          .filter((v): v is ReqBoardSavedView => !!v)
      : [];
    const activeViewId =
      typeof parsed.activeViewId === "string" ? parsed.activeViewId : null;
    return { views, activeViewId };
  } catch {
    return { views: [], activeViewId: null };
  }
}

export function writeReqBoardViewsState(state: ReqBoardViewsState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REQ_BOARD_VIEWS_KEY, JSON.stringify(state));
}

export function newViewId(): string {
  return `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function filtersEqual(a: ReqBoardFilters, b: ReqBoardFilters): boolean {
  return (
    a.projectId === b.projectId &&
    a.hideDone === b.hideDone &&
    a.query.trim() === b.query.trim() &&
    a.statuses.slice().sort().join("|") === b.statuses.slice().sort().join("|") &&
    a.priorities.slice().sort().join("|") === b.priorities.slice().sort().join("|")
  );
}
