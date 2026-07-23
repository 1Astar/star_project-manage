"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Project } from "@/lib/studio/types";
import { parseFeatureModulesInput } from "@/lib/studio/project-modules";

export function StudioGitSettings({ project }: { project: Project }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [githubRepo, setGithubRepo] = useState(project.githubRepo ?? "");
  const [githubBranch, setGithubBranch] = useState(project.githubBranch || "");
  const [codePath, setCodePath] = useState(project.codePath ?? "");
  const [demoUrl, setDemoUrl] = useState(project.demoUrl ?? "");
  const [localRunGuide, setLocalRunGuide] = useState(project.localRunGuide ?? "");
  const [vercelUrl, setVercelUrl] = useState(project.vercelUrl ?? "");
  const [featureModulesText, setFeatureModulesText] = useState(
    (project.featureModules ?? []).join("\n")
  );

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (githubRepo.trim() && !githubBranch.trim()) {
      setError("填写仓库时必须指定分支（勿默认 main）");
      return;
    }
    startTransition(async () => {
      try {
        const modules = parseFeatureModulesInput(featureModulesText);
        const [gitRes, projRes] = await Promise.all([
          fetch(`/api/studio/projects/${project.id}/git`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              githubRepo: githubRepo || null,
              githubBranch: githubBranch.trim() || null,
              codePath: codePath || null,
              demoUrl: demoUrl || null,
              localRunGuide: localRunGuide || null,
              vercelUrl: vercelUrl || null,
            }),
          }),
          fetch(`/api/studio/projects/${project.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ featureModules: modules }),
          }),
        ]);
        const gitData = await gitRes.json();
        const projData = await projRes.json();
        if (!gitRes.ok) {
          setError(gitData.error ?? "仓库保存失败");
          return;
        }
        if (!projRes.ok) {
          setError(projData.error ?? "板块保存失败");
          return;
        }
        const sync = projData.moduleTreeSync as
          | {
              createdL1?: number;
              createdL2?: number;
              skippedExisting?: number;
            }
          | null
          | undefined;
        if (sync && (sync.createdL1 || sync.createdL2)) {
          setMessage(
            `已保存（仓库 + 功能板块）；模块树新增 ${sync.createdL1 ?? 0} 个一级、${sync.createdL2 ?? 0} 个子模块`
          );
        } else if (sync) {
          setMessage("已保存（仓库 + 功能板块）；模块树已对齐（无新增）");
        } else {
          setMessage("已保存（仓库 + 功能板块）");
        }
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
        绑定仓库与<strong>实际分支</strong>；代码目录填仓库相对路径后，同步/任务匹配只看改动该目录的 commit。
      </p>
      <form onSubmit={handleSave} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-500">GitHub 仓库</span>
            <input
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="1Astar/chris-phone 或完整 GitHub URL"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            <p className="mt-1 text-xs text-slate-400">
              支持 owner/repo 或 https://github.com/owner/repo
            </p>
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">分支</span>
            <input
              value={githubBranch}
              onChange={(e) => setGithubBranch(e.target.value)}
              placeholder="填写项目实际分支，勿空着默认"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-slate-500">代码目录（monorepo 可选，勿填仓库 URL）</span>
          <input
            value={codePath}
            onChange={(e) => setCodePath(e.target.value)}
            placeholder="例：工具/private/工具/star-pm；整仓则留空"
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
        <label className="block text-sm">
          <span className="text-slate-500">功能板块</span>
          <textarea
            value={featureModulesText}
            onChange={(e) => setFeatureModulesText(e.target.value)}
            rows={5}
            placeholder={"每行一个，或逗号分隔\n例：对话聊天、相册图库、推送通知"}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-400">
            每行一条路径（建议「体系·功能面·能力」）。保存时会按首个「·」拆成模块树：一级=体系，子模块=其余；已有同名跳过。留空则按仓库用内置目录。
          </p>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "保存中…" : "保存仓库与板块"}
        </button>
      </form>
      {message ? <p className="mt-2 text-sm text-green-600">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
