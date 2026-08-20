"use client";

import { useCallback, useEffect, useState } from "react";

type TokenItem = {
  studioProjectId: string;
  title: string;
  token: string | null;
};

const PRIORITY_IDS = ["proj-moonpie", "proj-02c0940a", "proj-star-pm"];

export function BugFeedbackTokensPanel() {
  const [items, setItems] = useState<TokenItem[]>([]);
  const [envText, setEnvText] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedingAll, setSeedingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setHint(null);
    try {
      const res = await fetch("/api/studio/bug-feedback-tokens");
      const data = await res.json();
      if (!res.ok) {
        setHint(data.error ?? "加载失败");
        return;
      }
      const list = Array.isArray(data.items) ? (data.items as TokenItem[]) : [];
      setEnvText(typeof data.envText === "string" ? data.envText : "");
      list.sort((a, b) => {
        const ai = PRIORITY_IDS.indexOf(a.studioProjectId);
        const bi = PRIORITY_IDS.indexOf(b.studioProjectId);
        if (ai >= 0 || bi >= 0) {
          return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        }
        return a.title.localeCompare(b.title, "zh");
      });
      setItems(list);
    } catch {
      setHint("网络错误");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function ensureOrRotate(studioProjectId: string, rotate: boolean) {
    setBusyId(studioProjectId);
    setHint(null);
    try {
      const res = await fetch("/api/studio/bug-feedback-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studioProjectId, rotate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHint(data.error ?? "操作失败");
        return;
      }
      setHint(rotate ? "已轮换 token" : data.created ? "已生成 token" : "已有 token");
      await load();
    } catch {
      setHint("网络错误");
    } finally {
      setBusyId(null);
    }
  }

  async function seedAll() {
    setSeedingAll(true);
    setHint(null);
    try {
      const res = await fetch("/api/studio/bug-feedback-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensureAll: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHint(data.error ?? "生成失败");
        return;
      }
      setHint("全部项目 token 已齐，可复制/导出 .env");
      if (typeof data.envText === "string") setEnvText(data.envText);
      await load();
    } catch {
      setHint("网络错误");
    } finally {
      setSeedingAll(false);
    }
  }

  async function seedPriority() {
    setSeeding(true);
    setHint(null);
    try {
      const res = await fetch("/api/studio/bug-feedback-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensurePriority: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHint(data.error ?? "生成失败");
        return;
      }
      setHint("三端 token 已齐，可点「导出 .env」");
      if (typeof data.envText === "string") setEnvText(data.envText);
      await load();
    } catch {
      setHint("网络错误");
    } finally {
      setSeeding(false);
    }
  }

  async function copyEnv() {
    const text =
      envText ||
      items
        .filter((i) => PRIORITY_IDS.includes(i.studioProjectId) && i.token)
        .map((i) => `${i.studioProjectId}=${i.token}`)
        .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setHint("已复制 .env 文本到剪贴板");
    } catch {
      setHint("复制失败，请改用下载");
    }
  }

  function downloadEnv() {
    window.location.href = "/api/studio/bug-feedback-tokens?format=env";
  }

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setHint("已复制 token");
    } catch {
      setHint(token);
    }
  }

  const focus = items.filter((i) => PRIORITY_IDS.includes(i.studioProjectId));
  const rest = items.filter((i) => !PRIORITY_IDS.includes(i.studioProjectId));

  function row(item: TokenItem) {
    const busy = busyId === item.studioProjectId;
    return (
      <div
        key={item.studioProjectId}
        className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-800">{item.title}</div>
          <div className="truncate font-mono text-[11px] text-slate-500">
            {item.studioProjectId}
            {item.token ? ` · ${item.token}` : " · 未生成"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.token ? (
            <button
              type="button"
              onClick={() => void copyToken(item.token!)}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              复制
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void ensureOrRotate(item.studioProjectId, false)}
            className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {busy ? "…" : item.token ? "刷新显示" : "生成"}
          </button>
          {item.token ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void ensureOrRotate(item.studioProjectId, true)}
              className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            >
              轮换
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">
        各产品用 token 调公开接口{" "}
        <code className="rounded bg-stone-100 px-1">/api/public/bug-feedback</code>
        。Widget：
        <code className="rounded bg-stone-100 px-1">/bug-feedback-widget.js</code>
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={seeding}
          onClick={() => void seedPriority()}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {seeding ? "生成中…" : "一键生成三端 token"}
        </button>
        <button
          type="button"
          disabled={seedingAll}
          onClick={() => void seedAll()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {seedingAll ? "生成中…" : "全部项目生成"}
        </button>
        <button
          type="button"
          onClick={() => void copyEnv()}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
        >
          复制 .env
        </button>
        <button
          type="button"
          onClick={downloadEnv}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
        >
          导出 .env 文件
        </button>
      </div>
      {loading ? <p className="text-xs text-stone-500">加载中…</p> : null}
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-600">首批三端</p>
        {focus.map(row)}
      </div>
      {rest.length > 0 ? (
        <details className="rounded-md border border-slate-100 p-2">
          <summary className="cursor-pointer text-xs text-slate-600">其它项目</summary>
          <div className="mt-2 space-y-2">{rest.map(row)}</div>
        </details>
      ) : null}
      {hint ? <p className="text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}
