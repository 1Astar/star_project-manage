"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProjectGitSettingsAction } from "@/lib/actions";
import type { Project } from "@/lib/types";

export function ProjectGitSettings({
  project,
}: {
  project: Project;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [repoFullName, setRepoFullName] = useState(project.repo_full_name ?? "");
  const [repoBranch, setRepoBranch] = useState(project.repo_branch ?? "");
  const [repoUrl, setRepoUrl] = useState(project.repo_url ?? "");
  const [demoUrl, setDemoUrl] = useState(project.demo_url ?? "");
  const [localRunGuide, setLocalRunGuide] = useState(project.local_run_guide ?? "");
  const [codePath, setCodePath] = useState(project.code_path ?? "");
  const [vercelProjectId, setVercelProjectId] = useState(project.vercel_project_id ?? "");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await saveProjectGitSettingsAction({
          projectId: project.id,
          repo_full_name: repoFullName || null,
          repo_branch: repoBranch || null,
          repo_url: repoUrl || null,
          demo_url: demoUrl || null,
          local_run_guide: localRunGuide || null,
          code_path: codePath || null,
          vercel_project_id: vercelProjectId || undefined,
        });
        setMessage("已保存到 Supabase");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "保存失败");
      }
    });
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">代码仓库（Supabase 持久化）</h2>
      <p className="mt-1 text-sm text-slate-500">
        绑定 GitHub 仓库后，可在项目详情页手动同步 commit 记录。
      </p>
      <form onSubmit={handleSave} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-500">GitHub 仓库</span>
            <input
              value={repoFullName}
              onChange={(e) => setRepoFullName(e.target.value)}
              placeholder="1Astar/star_project-manage"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">分支</span>
            <input
              value={repoBranch}
              onChange={(e) => setRepoBranch(e.target.value)}
              placeholder="0623"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-slate-500">仓库 URL（可选，留空自动生成）</span>
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
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
          <span className="text-slate-500">本地启动方式</span>
          <textarea
            value={localRunGuide}
            onChange={(e) => setLocalRunGuide(e.target.value)}
            placeholder={"cd star-pm\nnpm run dev"}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">代码目录</span>
          <input
            value={codePath}
            onChange={(e) => setCodePath(e.target.value)}
            placeholder="工具/star-pm"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Vercel Project ID（可选）</span>
          <input
            value={vercelProjectId}
            onChange={(e) => setVercelProjectId(e.target.value)}
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
