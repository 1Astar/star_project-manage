"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Project } from "@/lib/studio/types";

export function StudioGitSettings({ project }: { project: Project }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [githubRepo, setGithubRepo] = useState(project.githubRepo ?? "");
  const [githubBranch, setGithubBranch] = useState(project.githubBranch || "main");
  const [codePath, setCodePath] = useState(project.codePath ?? "");
  const [demoUrl, setDemoUrl] = useState(project.demoUrl ?? "");
  const [localRunGuide, setLocalRunGuide] = useState(project.localRunGuide ?? "");
  const [vercelUrl, setVercelUrl] = useState(project.vercelUrl ?? "");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/studio/projects/${project.id}/git`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            githubRepo: githubRepo || null,
            githubBranch: githubBranch || "main",
            codePath: codePath || null,
            demoUrl: demoUrl || null,
            localRunGuide: localRunGuide || null,
            vercelUrl: vercelUrl || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "保存失败");
          return;
        }
        setMessage("已保存（有 PM 映射时同步镜像）");
        router.refresh();
      } catch {
        setError("网络错误");
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-800">代码仓库</h2>
      <p className="mt-1 text-sm text-slate-500">
        绑定 GitHub 仓库与分支；填写代码目录则按 monorepo 子路径过滤 commit。
      </p>
      <form onSubmit={handleSave} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-500">GitHub 仓库</span>
            <input
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="1Astar/star_project-manage"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">分支</span>
            <input
              value={githubBranch}
              onChange={(e) => setGithubBranch(e.target.value)}
              placeholder="main"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-slate-500">代码目录（monorepo 可选）</span>
          <input
            value={codePath}
            onChange={(e) => setCodePath(e.target.value)}
            placeholder="工具/private/工具/star-pm"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">展示链接</span>
          <input
            value={demoUrl}
            onChange={(e) => setDemoUrl(e.target.value)}
            placeholder="https://star-project-manage.vercel.app"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">本地启动</span>
          <textarea
            value={localRunGuide}
            onChange={(e) => setLocalRunGuide(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Vercel URL（可选）</span>
          <input
            value={vercelUrl}
            onChange={(e) => setVercelUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "保存中…" : "保存仓库配置"}
        </button>
      </form>
      {message ? <p className="mt-2 text-sm text-green-600">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
