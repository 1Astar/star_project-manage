"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBugTestPlanAction, updateBugStatusAction } from "@/lib/actions";
import { BugCreateModal, type BugFormOption, type MemberOption } from "@/components/bug-side-form";
import { BugImportOrganizePanel } from "@/components/bug-import-organize";
import { WorkbookImportPanel } from "@/components/workbook-import-panel";
import { TableExportButtons } from "@/components/table-export-buttons";
import { StudioBadge } from "@/components/studio/shell";
import type { Bug, BugTestPlan, Iteration, TaskStatus } from "@/lib/types";
import {
  BUG_SEVERITY_LABELS,
  TASK_STATUS_LABELS,
  type BugSeverity,
} from "@/lib/types";
import { BugTypeLabel } from "@/components/bug-type-label";
import { PRODUCT_ASSIGNEE_NAME } from "@/lib/assignee-roster";

const OPEN_STATUSES: TaskStatus[] = ["pending", "in_progress", "testing", "blocked"];
const RESOLVED: TaskStatus[] = ["done", "acceptance"];

export function ProjectBugsClient({
  projectId,
  projectSlug,
  bugs: initialBugs,
  members,
  requirements,
  featureModules = [],
  testPlans: initialTestPlans = [],
  iterations = [],
  currentUserName = PRODUCT_ASSIGNEE_NAME,
  initialShowCreate = false,
  initialRequirementId = "",
}: {
  projectId: string;
  projectSlug: string;
  bugs: Bug[];
  members: MemberOption[];
  requirements: BugFormOption[];
  featureModules?: string[];
  testPlans?: BugTestPlan[];
  iterations?: Iteration[];
  currentUserName?: string;
  initialShowCreate?: boolean;
  initialRequirementId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "open">("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(initialShowCreate);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [testPlans, setTestPlans] = useState(initialTestPlans);
  const [newPlanTitle, setNewPlanTitle] = useState("");

  const prefTitle = initialRequirementId
    ? `【关联】${requirements.find((r) => r.id === initialRequirementId)?.title ?? ""}`.trim()
    : "";

  const planTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of testPlans) map.set(p.id, p.title);
    return map;
  }, [testPlans]);

  const bugs = useMemo(() => {
    let list = initialBugs;
    if (filter === "open") {
      list = list.filter((b) => OPEN_STATUSES.includes(b.status));
    }
    if (planFilter === "none") {
      list = list.filter((b) => !b.test_plan_id);
    } else if (planFilter !== "all") {
      list = list.filter((b) => b.test_plan_id === planFilter);
    }
    return list;
  }, [initialBugs, filter, planFilter]);

  const visibleIds = useMemo(() => bugs.map((b) => b.id), [bugs]);
  const selectedVisible = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected]
  );
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  const exportIds = selectedVisible.length > 0 ? selectedVisible : null;
  const exportScope = exportIds ? null : filter === "open" ? "open" : "all";
  const exportHint =
    selectedVisible.length > 0
      ? `已选 ${selectedVisible.length} 项`
      : filter === "open"
        ? "未勾选：导出当前「未解决」"
        : "未勾选：导出全部";

  function setFilterAndPrune(next: "all" | "open") {
    setFilter(next);
    const nextVisible = new Set(
      (next === "open"
        ? initialBugs.filter((b) => OPEN_STATUSES.includes(b.status))
        : initialBugs
      ).map((b) => b.id)
    );
    setSelected((prev) => new Set([...prev].filter((id) => nextVisible.has(id))));
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
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Bug 反馈</h2>
          <p className="text-xs text-slate-500">共 {initialBugs.length} 项</p>
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
              onClick={() => setFilterAndPrune("all")}
              className={`rounded-lg px-3 py-1 ${filter === "all" ? "bg-white shadow-sm" : ""}`}
            >
              所有
            </button>
            <button
              type="button"
              onClick={() => setFilterAndPrune("open")}
              className={`rounded-lg px-3 py-1 ${filter === "open" ? "bg-white shadow-sm" : ""}`}
            >
              未解决
            </button>
          </div>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
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
        {testPlans.length > 0 ? (
          <p className="w-full text-[11px] text-slate-400">
            已有 {testPlans.filter((p) => p.status === "active").length} 个活跃计划
            {testPlans
              .filter((p) => p.status === "active")
              .slice(0, 5)
              .map((p) => p.title)
              .join(" · ")
              ? `：${testPlans
                  .filter((p) => p.status === "active")
                  .slice(0, 5)
                  .map((p) => p.title)
                  .join(" · ")}`
              : ""}
            {testPlans.filter((p) => p.status === "active").length > 5 ? "…" : ""}
          </p>
        ) : (
          <p className="w-full text-[11px] text-slate-400">
            可在提 Bug / 详情里关联；也支持在此先建计划。
          </p>
        )}
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
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
              <th className="px-3 py-2.5">标题</th>
              <th className="px-3 py-2.5">测试计划</th>
              <th className="px-3 py-2.5">优先级</th>
              <th className="px-3 py-2.5">严重</th>
              <th className="px-3 py-2.5">类型</th>
              <th className="px-3 py-2.5">状态</th>
              <th className="px-3 py-2.5">创建</th>
              <th className="px-3 py-2.5">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bugs.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  暂无 Bug
                </td>
              </tr>
            ) : (
              bugs.map((bug) => {
                const severity = (bug.severity ?? 3) as BugSeverity;
                const planTitle = bug.test_plan_id
                  ? planTitleById.get(bug.test_plan_id)
                  : null;
                return (
                  <tr key={bug.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(bug.id)}
                        onChange={() => toggleOne(bug.id)}
                        aria-label={`选择 ${bug.title}`}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/projects/${projectSlug}/bugs/${bug.id}`}
                        className="font-medium text-indigo-700 hover:underline"
                      >
                        {bug.title}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
                        {bug.module_path ? <span>{bug.module_path}</span> : null}
                        {bug.found_version ? <span>v {bug.found_version}</span> : null}
                        {bug.assignee ? <span>指派 {bug.assignee}</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {planTitle ?? (bug.test_plan_id ? "（计划已删）" : "—")}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {bug.priority ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {BUG_SEVERITY_LABELS[severity] ?? severity}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      <BugTypeLabel typeKey={bug.bug_type ?? "code"} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StudioBadge
                        tone={RESOLVED.includes(bug.status) ? "success" : "warning"}
                      >
                        {TASK_STATUS_LABELS[bug.status]}
                      </StudioBadge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">
                      {new Date(bug.created_at).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {!RESOLVED.includes(bug.status) ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setStatus(bug.id, "done")}
                            className="rounded border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-700"
                          >
                            解决
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setStatus(bug.id, "pending")}
                            className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600"
                          >
                            重开
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
