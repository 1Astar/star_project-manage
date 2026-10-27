/** Bug 列表：列配置 / 存视图 / 分组上色（本机按项目） */

export type BugListColumnKey =
  | "title"
  | "module_path"
  | "status"
  | "assignee"
  | "priority"
  | "severity"
  | "bug_type"
  | "test_plan"
  | "execution_case"
  | "found_version"
  | "resolved_version"
  | "environments"
  | "updated_at"
  | "updated_by"
  | "created_at"
  | "reporter_name"
  | "requirement"
  | "suggestion";

export type BugCustomColumnDef = {
  key: string;
  label: string;
  columnType: "text" | "select";
  options?: string[];
};

export type BugListGroupBy =
  | "none"
  | "status"
  | "module_path"
  | "priority"
  | "severity"
  | "assignee"
  | "bug_type";

export type BugListFilters = {
  query: string;
  statuses: string[];
  /** open = 未解决；all = 全部 */
  scope: "all" | "open";
  planId: string;
};

export type BugListSavedView = {
  id: string;
  name: string;
  filters: BugListFilters;
  visibleColumns: string[];
  columnOrder: string[];
  groupBy: BugListGroupBy;
  groupColors: Record<string, string>;
  sortKey: BugListColumnKey | "custom";
  sortDir: "asc" | "desc";
};

export type BugListPrefsState = {
  views: BugListSavedView[];
  activeViewId: string | null;
  customColumns: BugCustomColumnDef[];
  /** 未选视图时的草稿 */
  draft: Omit<BugListSavedView, "id" | "name">;
};

export const BUG_LIST_BUILTIN_COLUMNS: {
  key: BugListColumnKey;
  label: string;
  sortable?: boolean;
}[] = [
  { key: "title", label: "名称", sortable: true },
  { key: "module_path", label: "功能模块", sortable: true },
  { key: "status", label: "状态", sortable: true },
  { key: "assignee", label: "当前负责人", sortable: true },
  { key: "priority", label: "优先级", sortable: true },
  { key: "severity", label: "严重程度", sortable: true },
  { key: "bug_type", label: "类型", sortable: true },
  { key: "test_plan", label: "关联测试计划" },
  { key: "execution_case", label: "关联执行用例" },
  { key: "found_version", label: "发现版本" },
  { key: "resolved_version", label: "解决版本" },
  { key: "environments", label: "环境类型" },
  { key: "updated_at", label: "更新时间", sortable: true },
  { key: "updated_by", label: "更新人", sortable: true },
  { key: "created_at", label: "提出时间", sortable: true },
  { key: "reporter_name", label: "创建者", sortable: true },
  { key: "requirement", label: "关联需求" },
  { key: "suggestion", label: "优化建议" },
];

export const DEFAULT_BUG_VISIBLE: BugListColumnKey[] = [
  "title",
  "module_path",
  "status",
  "assignee",
  "priority",
  "severity",
  "updated_at",
  "updated_by",
  "created_at",
  "reporter_name",
];

export const DEFAULT_BUG_FILTERS: BugListFilters = {
  query: "",
  statuses: [],
  scope: "all",
  planId: "all",
};

export const DEFAULT_GROUP_COLORS: Record<string, string> = {
  pending: "#fef3c7",
  in_progress: "#dbeafe",
  testing: "#e0e7ff",
  acceptance: "#fce7f3",
  done: "#d1fae5",
  blocked: "#fee2e2",
};

function prefsKey(projectId: string) {
  return `star-pm:bug-list-prefs:${projectId}:v1`;
}

export function defaultBugListDraft(): BugListPrefsState["draft"] {
  return {
    filters: { ...DEFAULT_BUG_FILTERS },
    visibleColumns: [...DEFAULT_BUG_VISIBLE],
    columnOrder: BUG_LIST_BUILTIN_COLUMNS.map((c) => c.key),
    groupBy: "none",
    groupColors: { ...DEFAULT_GROUP_COLORS },
    sortKey: "updated_at",
    sortDir: "desc",
  };
}

export function readBugListPrefs(projectId: string): BugListPrefsState {
  const empty: BugListPrefsState = {
    views: [],
    activeViewId: null,
    customColumns: [],
    draft: defaultBugListDraft(),
  };
  if (typeof window === "undefined" || !projectId) return empty;
  try {
    const raw = window.localStorage.getItem(prefsKey(projectId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<BugListPrefsState>;
    const draft = {
      ...defaultBugListDraft(),
      ...(parsed.draft ?? {}),
      filters: {
        ...DEFAULT_BUG_FILTERS,
        ...(parsed.draft?.filters ?? {}),
      },
      groupColors: {
        ...DEFAULT_GROUP_COLORS,
        ...(parsed.draft?.groupColors ?? {}),
      },
    };
    return {
      views: Array.isArray(parsed.views) ? parsed.views : [],
      activeViewId:
        typeof parsed.activeViewId === "string" ? parsed.activeViewId : null,
      customColumns: Array.isArray(parsed.customColumns)
        ? parsed.customColumns
        : [],
      draft,
    };
  } catch {
    return empty;
  }
}

export function writeBugListPrefs(
  projectId: string,
  state: BugListPrefsState
): void {
  if (typeof window === "undefined" || !projectId) return;
  window.localStorage.setItem(prefsKey(projectId), JSON.stringify(state));
  void import("@/lib/ui/synced-pref").then(({ pushSyncedPref }) => {
    pushSyncedPref(`bug-list-prefs:${projectId}:v1`, state);
  });
}

export function newBugViewId(): string {
  return `bview-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function customColumnId(key: string): string {
  return `custom:${key}`;
}

export function parseCustomColumnId(id: string): string | null {
  return id.startsWith("custom:") ? id.slice(7) : null;
}
