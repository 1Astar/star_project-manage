"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRequirementDetailAction } from "@/lib/actions";
import type { Requirement, TaskStatus } from "@/lib/types";
import { REQUIREMENT_TYPE_LABELS, TASK_STATUS_LABELS } from "@/lib/types";

const STATUS_OPTIONS: TaskStatus[] = [
  "pending",
  "in_progress",
  "testing",
  "acceptance",
  "done",
  "blocked",
];

type Props = {
  projectSlug: string;
  /** 路由用 id（projects/[id]） */
  projectRouteId: string;
  projectName: string;
  requirement: Requirement;
  backHref: string;
  iterationName?: string | null;
  moduleL1Name?: string | null;
  moduleL2Name?: string | null;
  relatedBugs?: Array<{ id: string; title: string; status: TaskStatus }>;
  /** 右侧栏追加：角色任务、测试核对等 */
  sidebar?: ReactNode;
};

export function RequirementNotionPage({
  projectSlug,
  projectRouteId,
  projectName,
  requirement,
  backHref,
  iterationName,
  moduleL1Name,
  moduleL2Name,
  relatedBugs = [],
  sidebar,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sideTab, setSideTab] = useState<"basic" | "belong">("basic");
  const [title, setTitle] = useState(requirement.title);
  const [detailWork, setDetailWork] = useState(requirement.detail_work ?? "");
  const [acceptance, setAcceptance] = useState(requirement.acceptance_criteria ?? "");
  const [scenario, setScenario] = useState(requirement.scenario ?? "");
  const [optimization, setOptimization] = useState(requirement.optimization_notes ?? "");
  const [issues, setIssues] = useState(requirement.known_issues ?? "");
  const [prdLink, setPrdLink] = useState(requirement.prd_link ?? "");
  const [prototypeLink, setPrototypeLink] = useState(requirement.prototype_link ?? "");
  const [relatedLinks, setRelatedLinks] = useState(
    String(requirement.custom_fields?.related_links ?? "")
  );
  const [status, setStatus] = useState(requirement.status);
  const [priority, setPriority] = useState(requirement.priority ?? "");
  const [assignees, setAssignees] = useState((requirement.assignees ?? []).join("、"));
  const [reqSource, setReqSource] = useState(requirement.req_source ?? "");
  const [reqSourceNote, setReqSourceNote] = useState(requirement.req_source_note ?? "");
  const [hours, setHours] = useState(
    requirement.product_estimate_hours != null ? String(requirement.product_estimate_hours) : ""
  );
  const [dueDate, setDueDate] = useState(requirement.due_date ?? "");
  const [message, setMessage] = useState<string | null>(null);

  function save(updates: Parameters<typeof saveRequirementDetailAction>[0]["updates"]) {
    startTransition(async () => {
      try {
        setMessage(null);
        await saveRequirementDetailAction({
          requirementId: requirement.id,
          projectSlug,
          updates,
        });
        setMessage("已保存");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      }
    });
  }

  function saveAll() {
    const hoursNum = hours.trim() === "" ? null : Number(hours);
    save({
      title: title.trim() || requirement.title,
      detail_work: detailWork.trim() || null,
      acceptance_criteria: acceptance.trim() || null,
      scenario: scenario.trim() || null,
      optimization_notes: optimization.trim() || null,
      known_issues: issues.trim() || null,
      status,
      priority: priority.trim() || null,
      assignees: assignees
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean),
      req_source: reqSource.trim() || null,
      req_source_note: reqSourceNote.trim() || null,
      product_estimate_hours:
        hoursNum != null && Number.isFinite(hoursNum) ? hoursNum : null,
      due_date: dueDate.trim() || null,
      prd_link: prdLink.trim() || null,
      prototype_link: prototypeLink.trim() || null,
      custom_fields: {
        ...requirement.custom_fields,
        related_links: relatedLinks.trim() || null,
      },
    });
  }

  const relatedList = relatedLinks
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href={backHref} className="text-sm text-indigo-600 hover:underline">
          ← 返回
        </a>
        <div className="flex items-center gap-2">
          {message ? <span className="text-xs text-slate-500">{message}</span> : null}
          <button
            type="button"
            disabled={pending}
            onClick={saveAll}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
        <div className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title.trim() !== requirement.title) {
                save({ title: title.trim() });
              }
            }}
            className="w-full border-0 bg-transparent text-xl font-bold text-slate-900 outline-none placeholder:text-slate-300"
            placeholder="无标题需求"
          />

          <section className="space-y-1.5 border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold text-slate-500">需求描述</h3>
            <textarea
              value={detailWork}
              onChange={(e) => setDetailWork(e.target.value)}
              rows={6}
              placeholder="背景、方案、说明…"
              className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
            />
          </section>

          <section className="space-y-1.5 border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold text-slate-500">验收标准</h3>
            <textarea
              value={acceptance}
              onChange={(e) => setAcceptance(e.target.value)}
              rows={3}
              placeholder="可验收的完成标准"
              className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
            />
          </section>

          <section className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-slate-500">场景</h3>
              <textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-300"
              />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-slate-500">优化方向</h3>
              <textarea
                value={optimization}
                onChange={(e) => setOptimization(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-300"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <h3 className="text-xs font-semibold text-slate-500">已知问题</h3>
              <textarea
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-300"
              />
            </div>
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-3 lg:self-start">
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex gap-1 rounded-lg bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSideTab("basic")}
                className={`flex-1 rounded-md px-2 py-1 ${
                  sideTab === "basic" ? "bg-white font-medium text-slate-800 shadow-sm" : "text-slate-500"
                }`}
              >
                基本信息
              </button>
              <button
                type="button"
                onClick={() => setSideTab("belong")}
                className={`flex-1 rounded-md px-2 py-1 ${
                  sideTab === "belong" ? "bg-white font-medium text-slate-800 shadow-sm" : "text-slate-500"
                }`}
              >
                归属 / Bug
              </button>
            </div>

            {sideTab === "basic" ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>类型</span>
                  <span className="text-slate-700">
                    {REQUIREMENT_TYPE_LABELS[requirement.type] ?? requirement.type}
                  </span>
                </div>
                <label className="flex items-center justify-between gap-2">
                  <span className="shrink-0 text-slate-500">状态</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-800"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {TASK_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span className="shrink-0 text-slate-500">优先级</span>
                  <input
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    placeholder="P0"
                    className="w-20 rounded-md border border-slate-200 px-2 py-1 text-right text-slate-800"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-500">指派</span>
                  <input
                    value={assignees}
                    onChange={(e) => setAssignees(e.target.value)}
                    placeholder="多人用顿号分隔"
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-500">需求来源</span>
                  <input
                    value={reqSource}
                    onChange={(e) => setReqSource(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-500">来源备注</span>
                  <input
                    value={reqSourceNote}
                    onChange={(e) => setReqSourceNote(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                  />
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span className="shrink-0 text-slate-500">预计工时</span>
                  <input
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="h"
                    className="w-20 rounded-md border border-slate-200 px-2 py-1 text-right text-xs"
                  />
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span className="shrink-0 text-slate-500">截止日期</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs"
                  />
                </label>
                {requirement.in_pool ? (
                  <div className="text-xs text-amber-700">需求池</div>
                ) : null}
                <label className="block space-y-1">
                  <span className="text-slate-500">PRD</span>
                  <input
                    value={prdLink}
                    onChange={(e) => setPrdLink(e.target.value)}
                    placeholder="https://"
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-300"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-500">原型</span>
                  <input
                    value={prototypeLink}
                    onChange={(e) => setPrototypeLink(e.target.value)}
                    placeholder="https://"
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-300"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-500">其他链接</span>
                  <textarea
                    value={relatedLinks}
                    onChange={(e) => setRelatedLinks(e.target.value)}
                    rows={2}
                    placeholder="每行一个"
                    className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-300"
                  />
                </label>
                {relatedList.length > 0 || prdLink || prototypeLink ? (
                  <ul className="space-y-0.5 border-t border-slate-100 pt-2 text-xs">
                    {prdLink ? (
                      <li>
                        <a
                          href={prdLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          PRD →
                        </a>
                      </li>
                    ) : null}
                    {prototypeLink ? (
                      <li>
                        <a
                          href={prototypeLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          原型 →
                        </a>
                      </li>
                    ) : null}
                    {relatedList.map((url) => (
                      <li key={url} className="truncate">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                  创建 {new Date(requirement.created_at).toLocaleString("zh-CN")}
                  <br />
                  更新 {new Date(requirement.updated_at).toLocaleString("zh-CN")}
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">所属项目</span>
                  <span className="text-right font-medium text-slate-800">{projectName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">所属计划</span>
                  <span className="text-right text-slate-700">{iterationName || "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">所属模块</span>
                  <span className="text-right text-slate-700">
                    {[moduleL1Name, moduleL2Name].filter(Boolean).join(" / ") || "—"}
                  </span>
                </div>
                <div className="border-t border-slate-100 pt-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-medium text-slate-600">相关 Bug</span>
                    <a
                      href={`/projects/${projectRouteId}/bugs?new=1&req=${requirement.id}`}
                      className="rounded bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-indigo-500"
                    >
                      + 提 Bug
                    </a>
                  </div>
                  {relatedBugs.length === 0 ? (
                    <p className="text-slate-400">暂无关联 Bug</p>
                  ) : (
                    <ul className="space-y-1">
                      {relatedBugs.map((b) => (
                        <li key={b.id}>
                          <a
                            href={`/projects/${projectRouteId}/bugs/${b.id}`}
                            className="block truncate text-indigo-600 hover:underline"
                          >
                            {b.title}
                          </a>
                          <span className="text-slate-400">
                            {TASK_STATUS_LABELS[b.status] ?? b.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>

          {sidebar}
        </aside>
      </div>
    </div>
  );
}
