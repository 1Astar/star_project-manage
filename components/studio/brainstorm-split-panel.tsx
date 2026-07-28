"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudioBadge } from "@/components/studio/shell";
import { loadOpenAiSettings } from "@/lib/studio/ai/openai-settings";
import type { SplitBrainstormPreview, SplitTaskDraft } from "@/lib/studio/split-brainstorm";
import type { TaskPriority } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

type ProjectOption = { id: string; label: string };

const PRIORITIES: TaskPriority[] = ["P0", "P1", "P2", "P3"];

export function BrainstormSplitPanel({
  projects,
  defaultProjectId,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [text, setText] = useState("");
  const [preferAi, setPreferAi] = useState(true);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [poolHref, setPoolHref] = useState<string | null>(null);
  const [preview, setPreview] = useState<SplitBrainstormPreview | null>(null);

  const selectedCount = useMemo(
    () => preview?.tasks.filter((t) => t.selected).length ?? 0,
    [preview]
  );

  function updateTask(key: string, patch: Partial<SplitTaskDraft>) {
    setPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => (t.key === key ? { ...t, ...patch } : t)),
      };
    });
  }

  async function runPreview() {
    if (!projectId || !text.trim()) {
      setError("请选择项目并粘贴脑暴");
      return;
    }
    setLoading(true);
    setError(null);
    setSummary(null);
    setPoolHref(null);
    try {
      const ai = loadOpenAiSettings();
      const res = await fetch("/api/studio/ideas/split-brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "preview",
          projectId,
          text,
          preferAi,
          openAiApiKey: preferAi ? ai?.apiKey : undefined,
          openAiModel: preferAi ? ai?.model : undefined,
          openAiBaseUrl: preferAi ? ai?.baseUrl : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "拆分失败");
        return;
      }
      setPreview(data.preview as SplitBrainstormPreview);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!preview || !projectId) return;
    setCommitting(true);
    setError(null);
    setSummary(null);
    setPoolHref(null);
    try {
      const res = await fetch("/api/studio/ideas/split-brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          projectId,
          text,
          parentTitle: preview.parentTitle,
          parentSummary: preview.parentSummary,
          tasks: preview.tasks,
          writePool: true,
          writeStudioTasks: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "入库失败");
        return;
      }
      setSummary(
        `已写入灵感「${data.idea?.title ?? ""}」· 需求池 1 父 + ${data.poolCount ?? 0} 子` +
          (data.count ? ` · Studio 任务 ${data.count}` : "")
      );
      setPoolHref(typeof data.poolHref === "string" ? data.poolHref : null);
      setPreview(null);
      setText("");
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">粘贴脑暴 → 自动拆任务</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            粘贴整段想法，预览拆条后确认：写入 1 条灵感 + 需求池（父 epic + 子功能行）+ Studio 任务。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {open ? "收起" : "展开"}
        </button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="block text-sm">
              <span className="text-slate-500">挂到项目</span>
              <select
                className="mt-1 block min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={preferAi}
                onChange={(e) => setPreferAi(e.target.checked)}
              />
              有 OpenAI Key 时用 AI 拆（失败自动退回按 ①②/标题切）
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-slate-500">脑暴正文</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="直接粘贴，例如五大体系 ①塔罗 ②小六壬…"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading || !text.trim()}
              onClick={() => void runPreview()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "拆分中…" : "预览拆条"}
            </button>
            {preview ? (
              <button
                type="button"
                disabled={committing || selectedCount === 0}
                onClick={() => void commit()}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
              >
                {committing
                  ? "写入中…"
                  : `确认入库（需求池 + ${selectedCount} 条子项）`}
              </button>
            ) : null}
          </div>

          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          {summary ? (
            <p className="text-xs text-emerald-700">
              {summary}
              {poolHref ? (
                <>
                  {" · "}
                  <Link href={poolHref} className="underline underline-offset-2">
                    打开需求表看层级
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          {preview ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StudioBadge tone="p1">
                  {preview.method === "openai" ? "AI 拆分" : "规则拆分"}
                </StudioBadge>
                <span className="text-sm font-semibold text-slate-900">
                  灵感：{preview.parentTitle}
                </span>
              </div>
              {preview.parentSummary ? (
                <p className="text-xs text-slate-500">{preview.parentSummary}</p>
              ) : null}

              <ul className="space-y-2">
                {preview.tasks.map((task) => (
                  <li
                    key={task.key}
                    className={cn(
                      "rounded-lg border px-3 py-2",
                      task.selected ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 bg-slate-50"
                    )}
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-2"
                        checked={task.selected}
                        onChange={(e) => updateTask(task.key, { selected: e.target.checked })}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <input
                          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium hover:border-slate-200"
                          value={task.title}
                          onChange={(e) => updateTask(task.key, { title: e.target.value })}
                        />
                        <div className="flex flex-wrap gap-2">
                          <select
                            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px]"
                            value={task.priority}
                            onChange={(e) =>
                              updateTask(task.key, {
                                priority: e.target.value as TaskPriority,
                              })
                            }
                          >
                            {PRIORITIES.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                          <input
                            className="min-w-[140px] flex-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px]"
                            placeholder="板块（可选）"
                            value={task.module}
                            onChange={(e) => updateTask(task.key, { module: e.target.value })}
                          />
                        </div>
                        {task.progressNote ? (
                          <p className="line-clamp-2 text-[11px] text-slate-500">
                            {task.progressNote}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
