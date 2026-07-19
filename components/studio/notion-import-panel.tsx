"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearNotionSettings,
  loadNotionSettings,
  maskNotionToken,
  saveNotionSettings,
} from "@/lib/notion/notion-settings";

type ImportStats = {
  projects: number;
  ideas: number;
  evolutionLogs: number;
  tasks: number;
  assets: number;
};

export function NotionImportPanel() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [configured, setConfigured] = useState(false);
  const [tokenHint, setTokenHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const settings = loadNotionSettings();
    if (!settings) {
      setConfigured(false);
      return;
    }
    setToken(settings.token);
    setConfigured(true);
  }, []);

  function handleSaveToken() {
    const trimmed = token.trim();
    if (!trimmed) {
      clearNotionSettings();
      setConfigured(false);
      setTokenHint("已清除本机 Token");
      return;
    }
    saveNotionSettings({ token: trimmed });
    setConfigured(true);
    setTokenHint(`已保存到本机（${maskNotionToken(trimmed)}），不写入服务器`);
  }

  async function runImport(dryRun: boolean) {
    const notionToken = token.trim() || loadNotionSettings()?.token || "";
    if (!notionToken) {
      setError("请先填写 Notion Token 并点「保存到本机」");
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);
    setWarnings([]);

    try {
      const res = await fetch("/api/studio/import/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, notionToken }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "导入失败");
        return;
      }

      const stats = data.stats as ImportStats;
      setWarnings(data.warnings ?? []);
      setMessage(
        dryRun
          ? `预览：${stats.projects} 项目、${stats.ideas} 灵感、${stats.evolutionLogs} 演进、${stats.tasks} 任务、${stats.assets} 资料`
          : `已导入：${stats.projects} 项目、${stats.ideas} 灵感、${stats.evolutionLogs} 演进、${stats.tasks} 任务、${stats.assets} 资料`
      );

      if (!dryRun) router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50/40 p-5">
      <h2 className="text-sm font-semibold text-violet-800">从 Notion 导入</h2>
      <p className="mt-1 text-xs text-violet-600/80">
        拉取 Notion 灵感库 / 项目页，写入 Supabase；Token 仅存本机浏览器，导入时临时传给接口，不落库。
      </p>

      <label className="mt-3 block text-sm">
        <span className="text-xs text-violet-700/80">Notion Integration Token</span>
        <input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="secret_… 或 ntn_…"
          className="mt-1 w-full rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSaveToken}
          className="rounded-md border border-violet-300 bg-white px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-50"
        >
          保存到本机
        </button>
        {configured ? (
          <span className="text-xs text-emerald-700">本机已配置</span>
        ) : (
          <span className="text-xs text-slate-500">未配置</span>
        )}
      </div>
      {tokenHint ? <p className="mt-1 text-xs text-slate-500">{tokenHint}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => runImport(true)}
          className="rounded-md border border-violet-300 bg-white px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-50 disabled:opacity-50"
        >
          {loading ? "处理中…" : "预览"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => runImport(false)}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? "导入中…" : "导入并保存"}
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {warnings.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-amber-700">
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
