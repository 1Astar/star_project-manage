"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  createBugTestPlanAction,
  updateBugStatusAction,
} from "@/lib/actions";
import { BugCreateModal, type BugFormOption, type MemberOption } from "@/components/bug-side-form";
import { BugListPeekPanel } from "@/components/bug-list-peek";
import { BugImportOrganizePanel } from "@/components/bug-import-organize";
import { WorkbookImportPanel } from "@/components/workbook-import-panel";
import { TableExportButtons } from "@/components/table-export-buttons";
import { StudioBadge } from "@/components/studio/shell";
import { BugTypeLabel } from "@/components/bug-type-label";
import type { Bug, BugTestPlan, Iteration, TaskStatus } from "@/lib/types";
import {
  BUG_SEVERITY_LABELS,
  TASK_STATUS_LABELS,
  type BugSeverity,
} from "@/lib/types";
import { PRODUCT_ASSIGNEE_NAME } from "@/lib/assignee-roster";
import {
  BUG_LIST_BUILTIN_COLUMNS,
  customColumnId,
  defaultBugListDraft,
  newBugViewId,
  parseCustomColumnId,
  readBugListPrefs,
  writeBugListPrefs,
  type BugCustomColumnDef,
  type BugListGroupBy,
  type BugListPrefsState,
  type BugListSavedView,
} from "@/lib/bugs/bug-list-views";
import { cn } from "@/lib/utils";

const OPEN_STATUSES: TaskStatus[] = [
  "pending",
  "in_progress",
  "testing",
  "blocked",
  "integration",
];
const RESOLVED: TaskStatus[] = ["done", "acceptance"];

const GROUP_OPTIONS: { value: BugListGroupBy; label: string }[] = [
  { value: "none", label: "不分组" },
  { value: "status", label: "按状态" },
  { value: "module_path", label: "按功能模块" },
  { value: "priority", label: "按优先级" },
  { value: "severity", label: "按严重程度" },
  { value: "assignee", label: "按负责人" },
  { value: "bug_type", label: "按类型" },
];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function groupKeyOf(bug: Bug, groupBy: BugListGroupBy): string {
  switch (groupBy) {
    case "status":
      return bug.status;
    case "module_path":
      return bug.module_path?.trim() || "（未填模块）";
    case "priority":
      return bug.priority ?? "（无优先级）";
    case "severity":
      return String(bug.severity ?? 3);
    case "assignee":
      return bug.assignee?.trim() || "（未指派）";
    case "bug_type":
      return bug.bug_type ?? "code";
    default:
      return "";
  }
}

function groupLabel(groupBy: BugListGroupBy, key: string): string {
  if (groupBy === "status") return TASK_STATUS_LABELS[key as TaskStatus] ?? key;
  if (groupBy === "severity") {
    const n = Number(key) as BugSeverity;
    return BUG_SEVERITY_LABELS[n] ?? key;
  }
  return key;
}

export function ProjectBugsClient({
  projectId,
  projectSlug,
  projectName,
  bugs: initialBugs,
  members,
  requirements,
  featureModules = [],
  testPlans: initialTestPlans = [],
  iterations = [],
  currentUserName = PRODUCT_ASSIGNEE_NAME,
  initialShowCreate = false,
  initialRequirementId = "",
  initialPeekId = null,
  syncPeekUrl = false,
}: {
  projectId: string;
  projectSlug: string;
  projectName: string;
  bugs: Bug[];
  members: MemberOption[];
  requirements: BugFormOption[];
  featureModules?: string[];
  testPlans?: BugTestPlan[];
  iterations?: Iteration[];
  currentUserName?: string;
  initialShowCreate?: boolean;
  initialRequirementId?: string;
  /** 独立全页 /bugs/[id]：进入即打开分栏 Peek */
  initialPeekId?: string | null;
  /** 打开/关闭 Peek 时同步到 /bugs 或 /bugs/[id] */
  syncPeekUrl?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(initialShowCreate);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [testPlans, setTestPlans] = useState(initialTestPlans);
  const [newPlanTitle, setNewPlanTitle] = useState("");
  const [prefs, setPrefs] = useState<BugListPrefsState>(() => ({
    views: [],
    activeViewId: null,
    customColumns: [],
    draft: defaultBugListDraft(),
  }));
  const [prefsReady, setPrefsReady] = useState(false);
  const [showFields, setShowFields] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newCustomLabel, setNewCustomLabel] = useState("");
  const [peekId, setPeekId] = useState<string | null>(() =>
    initialPeekId && initialBugs.some((b) => b.id === initialPeekId)
      ? initialPeekId
      : null
  );
  const [query, setQuery] = useState("");

  const listHref = `/projects/${projectSlug}/bugs`;
  const bugHref = (id: string) => `/projects/${projectSlug}/bugs/${id}`;

  const openPeek = useCallback(
    (id: string) => {
      setPeekId(id);
      if (syncPeekUrl) {
        router.replace(bugHref(id), { scroll: false });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bugHref uses projectSlug
    [router, syncPeekUrl, projectSlug]
  );

  const closePeek = useCallback(() => {
    setPeekId(null);
    if (syncPeekUrl) {
      router.replace(listHref, { scroll: false });
    }
  }, [router, syncPeekUrl, listHref]);

  useEffect(() => {
    if (
      initialPeekId &&
      initialBugs.some((b) => b.id === initialPeekId) &&
      peekId !== initialPeekId
    ) {
      setPeekId(initialPeekId);
    }
    // 仅在路由带入的 id 变化时同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPeekId]);

  const prefTitle = initialRequirementId
    ? `【关联】${requirements.find((r) => r.id === initialRequirementId)?.title ?? ""}`.trim()
    : "";

  useEffect(() => {
    const loaded = readBugListPrefs(projectId);
    setPrefs(loaded);
    setQuery(loaded.draft.filters.query);
    setPrefsReady(true);
  }, [projectId]);

  const persist = useCallback(
    (next: BugListPrefsState) => {
      setPrefs(next);
      writeBugListPrefs(projectId, next);
    },
    [projectId]
  );

  const draft = prefs.draft;
  const reqTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of requirements) map.set(r.id, r.title);
    return map;
  }, [requirements]);

  const planTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of testPlans) map.set(p.id, p.title);
    return map;
  }, [testPlans]);

  const columnMeta = useMemo(() => {
    const map = new Map<string, { key: string; label: string; custom?: BugCustomColumnDef }>();
    for (const c of BUG_LIST_BUILTIN_COLUMNS) {
      map.set(c.key, { key: c.key, label: c.label });
    }
    for (const c of prefs.customColumns) {
      map.set(customColumnId(c.key), {
        key: customColumnId(c.key),
        label: c.label,
        custom: c,
      });
    }
    return map;
  }, [prefs.customColumns]);

  const orderedVisible = useMemo(() => {
    const order = draft.columnOrder.length
      ? draft.columnOrder
      : BUG_LIST_BUILTIN_COLUMNS.map((c) => c.key);
    const vis = new Set(draft.visibleColumns);
    const listed = order.filter((k) => vis.has(k) && columnMeta.has(k));
    for (const k of vis) {
      if (!listed.includes(k) && columnMeta.has(k)) listed.push(k);
    }
    if (!listed.includes("title")) listed.unshift("title");
    return listed;
  }, [draft.columnOrder, draft.visibleColumns, columnMeta]);

  const bugs = useMemo(() => {
    let list = initialBugs;
    const f = draft.filters;
    const q = (query || f.query).trim().toLowerCase();
    if (f.scope === "open") {
      list = list.filter((b) => OPEN_STATUSES.includes(b.status));
    }
    if (f.statuses.length) {
      list = list.filter((b) => f.statuses.includes(b.status));
    }
    if (f.planId === "none") {
      list = list.filter((b) => !b.test_plan_id);
    } else if (f.planId !== "all") {
      list = list.filter((b) => b.test_plan_id === f.planId);
    }
    if (q) {
      list = list.filter((b) => {
        const hay = [
          b.title,
          b.module_path,
          b.assignee,
          b.reporter_name,
          b.updated_by,
          b.found_version,
          b.resolved_version,
          b.execution_case,
          b.suggestion,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    const dir = draft.sortDir === "asc" ? 1 : -1;
    const sk = draft.sortKey;
    list = [...list].sort((a, b) => {
      const va = cellSortValue(a, sk, planTitleById, reqTitleById);
      const vb = cellSortValue(b, sk, planTitleById, reqTitleById);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return list;
  }, [initialBugs, draft.filters, draft.sortKey, draft.sortDir, query, planTitleById, reqTitleById]);

  const groups = useMemo(() => {
    if (draft.groupBy === "none") {
      return [{ key: "", label: "", bugs }];
    }
    const map = new Map<string, Bug[]>();
    for (const b of bugs) {
      const k = groupKeyOf(b, draft.groupBy);
      const arr = map.get(k) ?? [];
      arr.push(b);
      map.set(k, arr);
    }
    return [...map.entries()].map(([key, items]) => ({
      key,
      label: groupLabel(draft.groupBy, key),
      bugs: items,
    }));
  }, [bugs, draft.groupBy]);

  const peekBug = useMemo(
    () => (peekId ? initialBugs.find((b) => b.id === peekId) ?? null : null),
    [peekId, initialBugs]
  );

  const visibleIds = useMemo(() => bugs.map((b) => b.id), [bugs]);
  const selectedVisible = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected]
  );
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  const exportIds = selectedVisible.length > 0 ? selectedVisible : null;
  const exportScope =
    exportIds ? null : draft.filters.scope === "open" ? "open" : "all";
  const exportHint =
    selectedVisible.length > 0
      ? `已选 ${selectedVisible.length} 项`
      : draft.filters.scope === "open"
        ? "未勾选：导出当前「未解决」"
        : "未勾选：导出全部";

  function patchDraft(partial: Partial<BugListPrefsState["draft"]>) {
    persist({
      ...prefs,
      activeViewId: null,
      draft: { ...prefs.draft, ...partial },
    });
  }

  function setScope(scope: "all" | "open") {
    patchDraft({
      filters: { ...draft.filters, scope },
    });
    const nextVisible = new Set(
      (scope === "open"
        ? initialBugs.filter((b) => OPEN_STATUSES.includes(b.status))
        : initialBugs
      ).map((b) => b.id)
    );
    setSelected((prev) => new Set([...prev].filter((id) => nextVisible.has(id))));
  }

  function toggleColumn(key: string) {
    if (key === "title") return;
    const vis = new Set(draft.visibleColumns);
    if (vis.has(key)) vis.delete(key);
    else vis.add(key);
    const order = draft.columnOrder.includes(key)
      ? draft.columnOrder
      : [...draft.columnOrder, key];
    patchDraft({ visibleColumns: [...vis], columnOrder: order });
  }

  function moveColumn(key: string, dir: -1 | 1) {
    const order = [...orderedVisible];
    const i = order.indexOf(key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    const rest = draft.columnOrder.filter((k) => !order.includes(k));
    patchDraft({ columnOrder: [...order, ...rest] });
  }

  function addCustomColumn() {
    const label = newCustomLabel.trim();
    if (!label) return;
    const key = `c_${Date.now().toString(36)}`;
    const def: BugCustomColumnDef = { key, label, columnType: "text" };
    const id = customColumnId(key);
    persist({
      ...prefs,
      activeViewId: null,
      customColumns: [...prefs.customColumns, def],
      draft: {
        ...prefs.draft,
        visibleColumns: [...prefs.draft.visibleColumns, id],
        columnOrder: [...prefs.draft.columnOrder, id],
      },
    });
    setNewCustomLabel("");
  }

  function removeCustomColumn(key: string) {
    const id = customColumnId(key);
    if (!confirm(`删除自定义列「${columnMeta.get(id)?.label ?? key}」？已填值仍保留在 Bug 上，仅从列表去掉。`)) {
      return;
    }
    persist({
      ...prefs,
      activeViewId: null,
      customColumns: prefs.customColumns.filter((c) => c.key !== key),
      draft: {
        ...prefs.draft,
        visibleColumns: prefs.draft.visibleColumns.filter((k) => k !== id),
        columnOrder: prefs.draft.columnOrder.filter((k) => k !== id),
      },
    });
  }

  function saveView() {
    const name = newViewName.trim();
    if (!name) return;
    const view: BugListSavedView = {
      id: newBugViewId(),
      name,
      filters: { ...draft.filters, query },
      visibleColumns: [...draft.visibleColumns],
      columnOrder: [...draft.columnOrder],
      groupBy: draft.groupBy,
      groupColors: { ...draft.groupColors },
      sortKey: draft.sortKey,
      sortDir: draft.sortDir,
    };
    persist({
      ...prefs,
      views: [...prefs.views, view],
      activeViewId: view.id,
      draft: {
        ...draft,
        filters: view.filters,
        visibleColumns: view.visibleColumns,
        columnOrder: view.columnOrder,
        groupBy: view.groupBy,
        groupColors: view.groupColors,
        sortKey: view.sortKey,
        sortDir: view.sortDir,
      },
    });
    setNewViewName("");
    setShowViews(false);
  }

  function applyView(view: BugListSavedView) {
    setQuery(view.filters.query);
    persist({
      ...prefs,
      activeViewId: view.id,
      draft: {
        filters: { ...view.filters },
        visibleColumns: [...view.visibleColumns],
        columnOrder: [...view.columnOrder],
        groupBy: view.groupBy,
        groupColors: { ...view.groupColors },
        sortKey: view.sortKey,
        sortDir: view.sortDir,
      },
    });
    setShowViews(false);
  }

  function deleteView(id: string) {
    persist({
      ...prefs,
      views: prefs.views.filter((v) => v.id !== id),
      activeViewId: prefs.activeViewId === id ? null : prefs.activeViewId,
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function setStatus(bugId: string, status: TaskStatus) {
    startTransition(async () => {
      await updateBugStatusAction({ bugId, projectSlug, status });
      router.refresh();
    });
  }

  function createPlan() {
    const title = newPlanTitle.trim();
    if (!title) return;
    startTransition(async () => {
      const plan = await createBugTestPlanAction({
        projectId,
        projectSlug,
        title,
      });
      setNewPlanTitle("");
      setTestPlans((prev) =>
        prev.some((p) => p.id === plan.id) ? prev : [plan, ...prev]
      );
      router.refresh();
    });
  }

  function cellText(bug: Bug, colKey: string): string {
    const customKey = parseCustomColumnId(colKey);
    if (customKey) {
      const v = bug.custom_fields?.[customKey];
      if (v === null || v === undefined || v === "") return "—";
      return String(v);
    }
    switch (colKey) {
      case "title":
        return bug.title;
      case "module_path":
        return bug.module_path || "—";
      case "status":
        return TASK_STATUS_LABELS[bug.status] ?? bug.status;
      case "assignee":
        return bug.assignee || "—";
      case "priority":
        return bug.priority ?? "—";
      case "severity":
        return BUG_SEVERITY_LABELS[(bug.severity ?? 3) as BugSeverity] ?? String(bug.severity);
      case "bug_type":
        return bug.bug_type ?? "—";
      case "test_plan":
        return bug.test_plan_id
          ? planTitleById.get(bug.test_plan_id) ?? "（计划已删）"
          : "—";
      case "execution_case":
        return bug.execution_case || "—";
      case "found_version":
        return bug.found_version || "—";
      case "resolved_version":
        return bug.resolved_version || "—";
      case "environments":
        return bug.environments?.length ? bug.environments.join(", ") : "—";
      case "updated_at":
        return fmtDate(bug.updated_at);
      case "updated_by":
        return bug.updated_by || "—";
      case "created_at":
        return fmtDate(bug.created_at);
      case "reporter_name":
        return bug.reporter_name || "—";
      case "requirement":
        return bug.requirement_id
          ? reqTitleById.get(bug.requirement_id) ?? "—"
          : "—";
      case "suggestion":
        return bug.suggestion || "—";
      default:
        return "—";
    }
  }

  function renderCell(bug: Bug, colKey: string) {
    if (colKey === "title") {
      return (
        <div className="min-w-[12rem]">
          <button
            type="button"
            onClick={() => openPeek(bug.id)}
            className="text-left font-medium text-indigo-700 hover:underline"
          >
            {bug.title}
          </button>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-500">
            {bug.module_path ? <span>{bug.module_path}</span> : null}
            {bug.found_version ? <span>发现 {bug.found_version}</span> : null}
          </div>
        </div>
      );
    }
    if (colKey === "status") {
      return (
        <StudioBadge tone={RESOLVED.includes(bug.status) ? "success" : "warning"}>
          {TASK_STATUS_LABELS[bug.status]}
        </StudioBadge>
      );
    }
    if (colKey === "bug_type") {
      return <BugTypeLabel typeKey={bug.bug_type ?? "code"} />;
    }
    return (
      <span className="text-xs text-slate-600 whitespace-pre-wrap">
        {cellText(bug, colKey)}
      </span>
    );
  }

  const activeViewName = prefs.views.find((v) => v.id === prefs.activeViewId)?.name;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Bug 反馈</h2>
          <p className="text-xs text-slate-500">
            共 {initialBugs.length} 项
            {activeViewName ? ` · 视图「${activeViewName}」` : ""}
            {!prefsReady ? " · 载入偏好…" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TableExportButtons
            kind="bugs"
            project={projectSlug}
            label="导出 Bug"
            ids={exportIds}
            scope={exportScope}
            hint={exportHint}
          />
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm">
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`rounded-lg px-3 py-1 ${
                draft.filters.scope === "all" ? "bg-white shadow-sm" : ""
              }`}
            >
              所有
            </button>
            <button
              type="button"
              onClick={() => setScope("open")}
              className={`rounded-lg px-3 py-1 ${
                draft.filters.scope === "open" ? "bg-white shadow-sm" : ""
              }`}
            >
              未解决
            </button>
          </div>
          <select
            value={draft.filters.planId}
            onChange={(e) =>
              patchDraft({
                filters: { ...draft.filters, planId: e.target.value },
              })
            }
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
            aria-label="按测试计划筛选"
          >
            <option value="all">全部计划</option>
            <option value="none">未关联计划</option>
            {testPlans
              .filter((p) => p.status === "active")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            + 提 Bug
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() =>
            patchDraft({ filters: { ...draft.filters, query } })
          }
          placeholder="搜索标题 / 模块 / 版本 / 人…"
          className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
        />
        <select
          value={draft.groupBy}
          onChange={(e) =>
            patchDraft({ groupBy: e.target.value as BugListGroupBy })
          }
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        >
          {GROUP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowFields((v) => !v);
              setShowViews(false);
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            字段
          </button>
          {showFields ? (
            <div className="absolute right-0 z-30 mt-1 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <p className="mb-2 text-xs font-medium text-slate-700">显示字段（可排序）</p>
              <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
                {orderedVisible.map((key) => {
                  const meta = columnMeta.get(key);
                  const customKey = parseCustomColumnId(key);
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked
                        disabled={key === "title"}
                        onChange={() => toggleColumn(key)}
                      />
                      <span className="min-w-0 flex-1 truncate">{meta?.label ?? key}</span>
                      <button
                        type="button"
                        className="px-1 text-xs text-slate-400"
                        onClick={() => moveColumn(key, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="px-1 text-xs text-slate-400"
                        onClick={() => moveColumn(key, 1)}
                      >
                        ↓
                      </button>
                      {customKey ? (
                        <button
                          type="button"
                          className="px-1 text-xs text-rose-500"
                          onClick={() => removeCustomColumn(customKey)}
                        >
                          删
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className="mb-1 mt-3 text-xs font-medium text-slate-700">隐藏字段</p>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
                {[...columnMeta.keys()]
                  .filter((k) => !orderedVisible.includes(k))
                  .map((key) => (
                    <li key={key} className="flex items-center gap-2 px-1">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggleColumn(key)}
                      />
                      <span>{columnMeta.get(key)?.label ?? key}</span>
                    </li>
                  ))}
              </ul>
              <div className="mt-3 flex gap-1 border-t border-slate-100 pt-2">
                <input
                  value={newCustomLabel}
                  onChange={(e) => setNewCustomLabel(e.target.value)}
                  placeholder="新自定义列名"
                  className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={addCustomColumn}
                  className="rounded bg-slate-800 px-2 py-1 text-xs text-white"
                >
                  添加
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowViews((v) => !v);
              setShowFields(false);
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            视图
          </button>
          {showViews ? (
            <div className="absolute right-0 z-30 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <ul className="mb-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                {prefs.views.length === 0 ? (
                  <li className="text-xs text-slate-400">尚无已存视图</li>
                ) : (
                  prefs.views.map((v) => (
                    <li key={v.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        className={cn(
                          "min-w-0 flex-1 truncate rounded px-2 py-1 text-left hover:bg-slate-50",
                          prefs.activeViewId === v.id && "bg-indigo-50 text-indigo-800"
                        )}
                        onClick={() => applyView(v)}
                      >
                        {v.name}
                      </button>
                      <button
                        type="button"
                        className="px-1 text-xs text-rose-500"
                        onClick={() => deleteView(v.id)}
                      >
                        删
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <div className="flex gap-1 border-t border-slate-100 pt-2">
                <input
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="视图名称"
                  className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={saveView}
                  className="rounded bg-indigo-600 px-2 py-1 text-xs text-white"
                >
                  保存当前
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {draft.groupBy !== "none" ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>分组色：</span>
          {groups.map((g) => (
            <label key={g.key} className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5">
              <input
                type="color"
                value={draft.groupColors[g.key] ?? "#e2e8f0"}
                onChange={(e) =>
                  patchDraft({
                    groupColors: {
                      ...draft.groupColors,
                      [g.key]: e.target.value,
                    },
                  })
                }
                className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
              />
              <span>{g.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <div className="min-w-[12rem] flex-1">
          <label className="text-[11px] text-slate-500">测试计划（轻量，无用例库）</label>
          <input
            value={newPlanTitle}
            onChange={(e) => setNewPlanTitle(e.target.value)}
            placeholder="新建如 TP-文件备份"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createPlan();
              }
            }}
          />
        </div>
        <button
          type="button"
          disabled={pending || !newPlanTitle.trim()}
          onClick={createPlan}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          新建计划
        </button>
      </div>

      <WorkbookImportPanel projectSlug={projectSlug} compact />
      <BugImportOrganizePanel projectId={projectId} projectSlug={projectSlug} />

      <BugCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        projectId={projectId}
        projectSlug={projectSlug}
        members={members}
        requirements={requirements}
        featureModules={featureModules}
        testPlans={testPlans}
        iterations={iterations}
        currentUserName={currentUserName}
        initialRequirementId={initialRequirementId}
        initialTitle={prefTitle === "【关联】" ? "" : prefTitle}
      />

      <div
        className={cn(
          "flex gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white",
          peekBug ? "h-[min(78vh,52rem)] flex-row" : "min-h-[28rem] flex-col"
        )}
      >
        <div
          className={cn(
            "min-h-0 min-w-0 overflow-auto",
            peekBug ? "w-[42%] shrink-0 border-r border-slate-100" : "w-full"
          )}
        >
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={visibleIds.length === 0}
                    onChange={toggleAllVisible}
                    aria-label="全选当前列表"
                    className="rounded border-slate-300"
                  />
                </th>
                {orderedVisible.map((key) => (
                  <th key={key} className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      className="hover:text-slate-800"
                      onClick={() => {
                        if (draft.sortKey === key) {
                          patchDraft({
                            sortDir: draft.sortDir === "asc" ? "desc" : "asc",
                          });
                        } else {
                          patchDraft({
                            sortKey: key as typeof draft.sortKey,
                            sortDir: "asc",
                          });
                        }
                      }}
                    >
                      {columnMeta.get(key)?.label ?? key}
                      {draft.sortKey === key
                        ? draft.sortDir === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-2.5">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bugs.length === 0 ? (
                <tr>
                  <td
                    colSpan={orderedVisible.length + 2}
                    className="px-3 py-8 text-center text-slate-400"
                  >
                    暂无 Bug
                  </td>
                </tr>
              ) : (
                groups.map((g) => (
                  <GroupRows
                    key={g.key || "all"}
                    group={g}
                    showHeader={draft.groupBy !== "none"}
                    headerColor={draft.groupColors[g.key]}
                    colSpan={orderedVisible.length + 2}
                    orderedVisible={orderedVisible}
                    selected={selected}
                    peekId={peekId}
                    pending={pending}
                    onToggle={toggleOne}
                    onPeek={openPeek}
                    renderCell={renderCell}
                    onResolve={(id) => setStatus(id, "done")}
                    onReopen={(id) => setStatus(id, "pending")}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {peekBug ? (
          <div className="min-h-0 min-w-0 flex-1">
            <BugListPeekPanel
              bugId={peekBug.id}
              fallbackBug={peekBug}
              projectId={projectId}
              projectSlug={projectSlug}
              projectName={projectName}
              members={members}
              requirements={requirements}
              featureModules={featureModules}
              testPlans={testPlans}
              iterations={iterations}
              onClose={closePeek}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function cellSortValue(
  bug: Bug,
  sk: string,
  planTitleById: Map<string, string>,
  reqTitleById: Map<string, string>
): string {
  const customKey = parseCustomColumnId(sk);
  if (customKey) return String(bug.custom_fields?.[customKey] ?? "");
  switch (sk) {
    case "title":
      return bug.title;
    case "module_path":
      return bug.module_path ?? "";
    case "status":
      return bug.status;
    case "assignee":
      return bug.assignee ?? "";
    case "priority":
      return bug.priority ?? "";
    case "severity":
      return String(bug.severity ?? 3);
    case "bug_type":
      return bug.bug_type ?? "";
    case "test_plan":
      return bug.test_plan_id
        ? planTitleById.get(bug.test_plan_id) ?? ""
        : "";
    case "execution_case":
      return bug.execution_case ?? "";
    case "found_version":
      return bug.found_version ?? "";
    case "resolved_version":
      return bug.resolved_version ?? "";
    case "updated_at":
      return bug.updated_at ?? "";
    case "updated_by":
      return bug.updated_by ?? "";
    case "created_at":
      return bug.created_at ?? "";
    case "reporter_name":
      return bug.reporter_name ?? "";
    case "requirement":
      return bug.requirement_id
        ? reqTitleById.get(bug.requirement_id) ?? ""
        : "";
    case "suggestion":
      return bug.suggestion ?? "";
    default:
      return "";
  }
}

function GroupRows({
  group,
  showHeader,
  headerColor,
  colSpan,
  orderedVisible,
  selected,
  peekId,
  pending,
  onToggle,
  onPeek,
  renderCell,
  onResolve,
  onReopen,
}: {
  group: { key: string; label: string; bugs: Bug[] };
  showHeader: boolean;
  headerColor?: string;
  colSpan: number;
  orderedVisible: string[];
  selected: Set<string>;
  peekId: string | null;
  pending: boolean;
  onToggle: (id: string) => void;
  onPeek: (id: string) => void;
  renderCell: (bug: Bug, col: string) => ReactNode;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
}) {
  return (
    <>
      {showHeader ? (
        <tr>
          <td
            colSpan={colSpan}
            className="px-3 py-1.5 text-xs font-medium text-slate-700"
            style={{ backgroundColor: headerColor ?? "#f1f5f9" }}
          >
            {group.label}
            <span className="ml-2 font-normal text-slate-500">
              {group.bugs.length}
            </span>
          </td>
        </tr>
      ) : null}
      {group.bugs.map((bug) => (
        <tr
          key={bug.id}
          className={cn(
            "hover:bg-slate-50/80",
            peekId === bug.id && "bg-indigo-50/60"
          )}
          style={
            showHeader && headerColor
              ? { boxShadow: `inset 3px 0 0 ${headerColor}` }
              : undefined
          }
        >
          <td className="px-3 py-2.5">
            <input
              type="checkbox"
              checked={selected.has(bug.id)}
              onChange={() => onToggle(bug.id)}
              aria-label={`选择 ${bug.title}`}
              className="rounded border-slate-300"
            />
          </td>
          {orderedVisible.map((key) => (
            <td
              key={key}
              className="px-3 py-2.5"
              onClick={key === "title" ? undefined : () => onPeek(bug.id)}
            >
              {renderCell(bug, key)}
            </td>
          ))}
          <td className="px-3 py-2.5">
            <div className="flex flex-wrap gap-1">
              {!RESOLVED.includes(bug.status) ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onResolve(bug.id)}
                  className="rounded border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-700"
                >
                  解决
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onReopen(bug.id)}
                  className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600"
                >
                  重开
                </button>
              )}
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
