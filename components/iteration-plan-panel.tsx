"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPlanningIterationAction,
  updatePlanningIterationAction,
} from "@/lib/actions";
import {
  ITERATION_STATUS_LABELS,
  iterationModuleSummary,
  iterationTimeStatus,
} from "@/lib/iteration-status";
import type { Iteration, Requirement } from "@/lib/types";
import type { StudioRelease } from "@/lib/studio/types";
import { StudioBadge } from "@/components/studio/shell";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  projectSlug: string;
  iterations: Iteration[];
  requirements: Requirement[];
  releases: StudioRelease[];
};

export function IterationPlanPanel({
  projectId,
  projectSlug,
  iterations,
  requirements,
  releases,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(iterations[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newTag, setNewTag] = useState("");

  const selected = iterations.find((i) => i.id === selectedId) ?? iterations[0] ?? null;

  const summary = useMemo(() => {
    if (!selected) return null;
    return iterationModuleSummary(requirements, selected.id);
  }, [requirements, selected]);

  const status = selected ? iterationTimeStatus(selected) : null;

  function saveSelected(patch: {
    name?: string;
    start_date?: string | null;
    end_date?: string | null;
    release_tag?: string | null;
  }) {
    if (!selected) return;
    startTransition(async () => {
      try {
        await updatePlanningIterationAction({
          iterationId: selected.id,
          projectSlug,
          updates: patch,
        });
        setMessage("迭代已保存");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      }
    });
  }

  function createIteration(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const iter = await createPlanningIterationAction({
          projectId,
          projectSlug,
          name: newName,
          start_date: newStart || null,
          end_date: newEnd || null,
          release_tag: newTag || null,
        });
        setNewName("");
        setNewStart("");
        setNewEnd("");
        setNewTag("");
        setCreating(false);
        setSelectedId(iter.id);
        setMessage("已新建迭代");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "创建失败");
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">迭代计划</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            起止日切状态 · 可挂 GitHub 版本 · 下方为本期顶层模块概况
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {creating ? "取消" : "+ 新建迭代"}
        </button>
      </div>

      {message ? <p className="mb-2 text-xs text-slate-500">{message}</p> : null}

      {creating ? (
        <form
          onSubmit={createIteration}
          className="mb-4 grid gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-2"
        >
          <label className="text-xs sm:col-span-2">
            <span className="text-slate-500">名称</span>
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
              placeholder="例：2026-07 Sprint"
            />
          </label>
          <label className="text-xs">
            <span className="text-slate-500">开始</span>
            <input
              type="date"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="text-slate-500">结束</span>
            <input
              type="date"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="text-slate-500">挂版本</span>
            <select
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">不绑定</option>
              {releases.map((r) => (
                <option key={r.id} value={r.tag}>
                  {r.name || r.tag}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={pending || !newName.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 sm:col-span-2"
          >
            创建
          </button>
        </form>
      ) : null}

      {iterations.length === 0 ? (
        <p className="text-sm text-slate-400">暂无规划迭代。先新建，再从需求池「加入该计划」。</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {iterations.map((it) => {
              const st = iterationTimeStatus(it);
              const on = selected?.id === it.id;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setSelectedId(it.id)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-left text-xs transition",
                    on
                      ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <span className="font-medium">{it.name}</span>
                  <span className="ml-2 text-[10px] text-slate-400">
                    {ITERATION_STATUS_LABELS[st]}
                  </span>
                </button>
              );
            })}
          </div>

          {selected ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs">
                  <span className="text-slate-500">名称</span>
                  <input
                    defaultValue={selected.name}
                    key={`name-${selected.id}-${selected.name}`}
                    disabled={pending}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== selected.name) saveSelected({ name: v });
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-slate-500">开始</span>
                  <input
                    type="date"
                    defaultValue={selected.start_date ?? ""}
                    key={`start-${selected.id}-${selected.start_date}`}
                    disabled={pending}
                    onChange={(e) => saveSelected({ start_date: e.target.value || null })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-slate-500">结束</span>
                  <input
                    type="date"
                    defaultValue={selected.end_date ?? ""}
                    key={`end-${selected.id}-${selected.end_date}`}
                    disabled={pending}
                    onChange={(e) => saveSelected({ end_date: e.target.value || null })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="text-slate-500">挂版本</span>
                  <select
                    value={selected.release_tag ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      saveSelected({ release_tag: e.target.value || null })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">不绑定</option>
                    {releases.map((r) => (
                      <option key={r.id} value={r.tag}>
                        {r.name || r.tag}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {status ? <StudioBadge tone="muted">{ITERATION_STATUS_LABELS[status]}</StudioBadge> : null}
                {summary ? (
                  <span>
                    本期需求 {summary.total} · 完成 {summary.done}
                    {summary.total > 0
                      ? `（${Math.round((summary.done / summary.total) * 100)}%）`
                      : ""}
                  </span>
                ) : null}
                {selected.release_tag ? (
                  <span className="text-indigo-600">版本 {selected.release_tag}</span>
                ) : null}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold text-slate-700">本期模块概况</h3>
                {!summary || summary.rows.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    暂无顶层模块。把大型模块（epic）或根需求加入本迭代后会出现汇总。
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">模块</th>
                          <th className="px-3 py-2 font-medium">完成</th>
                          <th className="px-3 py-2 font-medium">进行</th>
                          <th className="px-3 py-2 font-medium">待开始</th>
                          <th className="px-3 py-2 font-medium">合计</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {summary.rows.map((row) => (
                          <tr key={row.moduleId}>
                            <td className="px-3 py-2 font-medium text-slate-800">{row.title}</td>
                            <td className="px-3 py-2 tabular-nums text-emerald-700">{row.done}</td>
                            <td className="px-3 py-2 tabular-nums text-amber-700">{row.active}</td>
                            <td className="px-3 py-2 tabular-nums text-slate-600">{row.todo}</td>
                            <td className="px-3 py-2 tabular-nums text-slate-800">{row.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
