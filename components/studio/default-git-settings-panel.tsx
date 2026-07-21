"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function DefaultGitSettingsPanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [repo, setRepo] = useState("1Astar/star_project-manage");
  const [branch, setBranch] = useState("main");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyToUnbound() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/studio/projects/apply-default-git", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo, branch }),
        });
        const data = await res.json();
        if (!res.ok) {
          const raw = typeof data.error === "string" ? data.error : "应用失败";
          setError(
            /feature_modules|schema cache/i.test(raw)
              ? "数据库缺少 feature_modules 列。请在 Supabase 执行迁移 028_evolution_modules.sql 后重试。"
              : raw
          );
          return;
        }
        setMessage(`已应用到 ${data.count} 个未绑定项目：${(data.projects as string[]).join("、") || "无"}`);
        router.refresh();
      } catch {
        setError("网络错误");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-500">默认总仓</span>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">默认分支</span>
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>
      <p className="text-xs text-slate-500">
        只填充尚未绑定 githubRepo 的 Studio 项目；monorepo 的 code_path 仍由各项目自行填写。
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={applyToUnbound}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "应用中…" : "应用到所有未绑定的 Studio 项目"}
      </button>
      {message ? <p className="text-sm text-green-600">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
