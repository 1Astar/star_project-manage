"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StudioBadge } from "@/components/studio/shell";
import { loadOpenAiSettings } from "@/lib/studio/ai/openai-settings";
import type { IdeaDigestResult } from "@/lib/studio/ai/digest-ideas";
import type { DigestRouteAction } from "@/lib/studio/apply-digest-route";

const ACTION_LABELS: Record<DigestRouteAction, string> = {
  to_project: "转项目",
  to_task: "转任务",
  observe: "观察",
  discard: "丢弃",
};

type ProjectOption = { id: string; label: string };
type IdeaOption = { id: string; title: string };

type RouteRow = IdeaDigestResult["suggestedRoutes"][number];

export function IdeaDigestPanel({
  projects,
  ideas,
}: {
  projects: ProjectOption[];
  ideas: IdeaOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applySummary, setApplySummary] = useState<string | null>(null);
  const [digest, setDigest] = useState<IdeaDigestResult | null>(null);
  const [ideaCount, setIdeaCount] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const projectNameById = new Map(projects.map((p) => [p.id, p.label]));
  const ideaTitleById = useMemo(() => new Map(ideas.map((i) => [i.id, i.title])), [ideas]);

  const pendingRoutes = useMemo(() => {
    if (!digest) return [];
    return digest.suggestedRoutes.filter((route) => !doneIds.has(route.ideaId));
  }, [digest, doneIds]);

  async function runDigest() {
    const aiSettings = loadOpenAiSettings();
    if (!aiSettings) {
      setError("请先在设置页配置 OpenAI API Key");
      return;
    }

    setLoading(true);
    setError(null);
    setApplySummary(null);
    setDoneIds(new Set());

    try {
      const res = await fetch("/api/studio/ideas/digest?date=today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "today",
          openAiApiKey: aiSettings.apiKey,
          openAiModel: aiSettings.model,
          openAiBaseUrl: aiSettings.baseUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "整理失败");
        return;
      }
      const nextDigest = data.digest as IdeaDigestResult;
      setDigest(nextDigest);
      setIdeaCount(data.ideaCount ?? 0);
      setSelected(new Set(nextDigest.suggestedRoutes.map((r) => r.ideaId)));
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  function toggleRoute(ideaId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ideaId)) next.delete(ideaId);
      else next.add(ideaId);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(pendingRoutes.map((r) => r.ideaId)));
    } else {
      setSelected(new Set());
    }
  }

  async function applySelected() {
    if (!digest || selected.size === 0) return;

    const routes = digest.suggestedRoutes.filter(
      (route) => selected.has(route.ideaId) && !doneIds.has(route.ideaId)
    );
    if (routes.length === 0) return;

    const ok = window.confirm(
      `确认执行 ${routes.length} 条建议？\n\n归项目 = 关联已有项目（无目标则新建）\n转任务 = 在项目下建任务\n观察 = 标为审阅中\n丢弃 = 归档`
    );
    if (!ok) return;

    setApplying(true);
    setError(null);
    setApplySummary(null);

    try {
      const res = await fetch("/api/studio/ideas/digest/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "执行失败");
        return;
      }

      const results = data.results as Array<{ ideaId: string; ok: boolean; error?: string }>;
      const succeeded = results.filter((r) => r.ok).map((r) => r.ideaId);
      const failures = results.filter((r) => !r.ok);
      setDoneIds((prev) => new Set([...prev, ...succeeded]));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of succeeded) next.delete(id);
        return next;
      });
      const failHint =
        failures.length > 0
          ? `；失败：${failures.map((f) => `${ideaTitleById.get(f.ideaId) ?? f.ideaId}（${f.error ?? "未知"}）`).join("、")}`
          : "";
      setApplySummary(`已执行 ${data.applied} 条，失败 ${data.failed} 条${failHint}`);
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setApplying(false);
    }
  }

  function renderRouteRow(route: RouteRow) {
    const isDone = doneIds.has(route.ideaId);
    const title = ideaTitleById.get(route.ideaId) ?? route.ideaId;

    return (
      <li
        key={route.ideaId}
        className={`flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
          isDone ? "bg-emerald-50/80 opacity-70" : "bg-white/80"
        }`}
      >
        <input
          type="checkbox"
          checked={selected.has(route.ideaId) && !isDone}
          disabled={isDone || applying}
          onChange={() => toggleRoute(route.ideaId)}
          className="rounded border-slate-300"
        />
        <span className={`font-medium ${isDone ? "text-slate-500 line-through" : "text-slate-800"}`}>
          {title}
        </span>
        <StudioBadge tone={isDone ? "success" : "default"}>
          {isDone ? "已执行" : ACTION_LABELS[route.action]}
        </StudioBadge>
        {route.targetProjectId ? (
          <span className="text-xs text-indigo-600">
            → {projectNameById.get(route.targetProjectId) ?? route.targetProjectId}
          </span>
        ) : null}
        {route.reason ? <span className="text-xs text-slate-500">{route.reason}</span> : null}
      </li>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">整理今天的脑暴</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            AI 聚类今日灵感，勾选建议后批量执行（可逐条确认）
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runDigest()}
          disabled={loading || applying}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "整理中…" : "开始整理"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {applySummary ? <p className="mt-3 text-sm text-emerald-700">{applySummary}</p> : null}

      {digest ? (
        <div className="mt-4 space-y-4 border-t border-indigo-100 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>今日 {digest.stats.newToday ?? ideaCount} 条</span>
            {Object.entries(digest.stats.byProject).map(([pid, count]) => (
              <StudioBadge key={pid} tone="muted">
                {pid === "__none__" ? "未归属" : projectNameById.get(pid) ?? pid} · {count}
              </StudioBadge>
            ))}
          </div>

          {digest.themes.length > 0 ? (
            <div>
              <div className="text-xs font-medium text-slate-500">主题</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {digest.themes.map((theme) => (
                  <span
                    key={theme}
                    className="rounded-full bg-white px-3 py-1 text-sm text-indigo-700 ring-1 ring-indigo-100"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {digest.clusters.length > 0 ? (
            <div>
              <div className="text-xs font-medium text-slate-500">聚类</div>
              <ul className="mt-2 space-y-2">
                {digest.clusters.map((cluster) => (
                  <li
                    key={cluster.title}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <div className="font-medium text-slate-800">{cluster.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{cluster.ideaIds.length} 条关联</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {digest.suggestedRoutes.length > 0 ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-medium text-slate-500">建议去向</div>
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1 text-slate-600">
                    <input
                      type="checkbox"
                      checked={pendingRoutes.length > 0 && selected.size === pendingRoutes.length}
                      onChange={(e) => toggleAll(e.target.checked)}
                      disabled={applying || pendingRoutes.length === 0}
                    />
                    全选
                  </label>
                  <button
                    type="button"
                    onClick={() => void applySelected()}
                    disabled={applying || selected.size === 0}
                    className="rounded-md bg-slate-900 px-3 py-1 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {applying ? "执行中…" : `执行选中 (${selected.size})`}
                  </button>
                </div>
              </div>
              <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                {digest.suggestedRoutes.map(renderRouteRow)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
