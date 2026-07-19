"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StudioGitActivity } from "@/lib/studio/git-utils";
import { studioProjectHasGit, studioProjectRepoUrl } from "@/lib/studio/git-utils";
import type { Project } from "@/lib/studio/types";
import { StudioGitSettings } from "@/components/studio/studio-git-settings";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StudioGitPanel({
  project,
  activities: initialActivities,
}: {
  project: Project;
  activities: StudioGitActivity[];
}) {
  const router = useRouter();
  const [activities, setActivities] = useState(initialActivities);
  const [syncInfo, setSyncInfo] = useState({
    lastSyncedAt: project.lastGitSyncedAt,
    lastCommitSha: project.lastCommitSha,
    lastCommitMessage: project.lastCommitMessage,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(!studioProjectHasGit(project));

  const hasRepo = studioProjectHasGit(project);
  const githubUrl = studioProjectRepoUrl(project);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/studio/projects/${project.id}/git`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "同步失败");
      setSyncInfo({
        lastSyncedAt: data.syncedAt,
        lastCommitSha: data.latest?.sha ?? syncInfo.lastCommitSha,
        lastCommitMessage: data.latest?.message ?? syncInfo.lastCommitMessage,
      });
      if (typeof data.fetchedCount === "number" && data.fetchedCount === 0) {
        setMessage(null);
        setError(
          data.warning ??
            "未拉到任何提交。请核对仓库、分支是否为刚推送的分支，以及代码目录是否填错（勿填 GitHub 链接）"
        );
      } else {
        setMessage(
          data.newCount > 0
            ? `新增 ${data.newCount} 条提交记录`
            : `已是最新（共 ${data.fetchedCount ?? 0} 条近期提交）`
        );
        setError(data.warning ?? null);
      }
      if (Array.isArray(data.activities)) setActivities(data.activities);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "同步失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {hasRepo ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">最近 Git 更新</h2>
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <div>
                  <span className="text-slate-400">仓库：</span>
                  {project.githubRepo}
                  {project.codePath ? (
                    <span className="ml-2 text-xs text-slate-400">
                      目录: {project.codePath}
                    </span>
                  ) : null}
                </div>
                {project.codePath && /^https?:\/\//i.test(project.codePath.trim()) ? (
                  <p className="text-xs text-amber-700">
                    「代码目录」填成了链接，同步时会被忽略。请改成仓库内相对路径（如
                    工具/private/工具/star-pm），或清空拉整仓。
                  </p>
                ) : null}                <div>
                  <span className="text-slate-400">分支：</span>
                  {project.githubBranch || "（未配置分支）"}
                </div>
                <div>
                  <span className="text-slate-400">最后同步：</span>
                  {formatTime(syncInfo.lastSyncedAt)}
                </div>
                {syncInfo.lastCommitSha ? (
                  <div>
                    <span className="text-slate-400">最后提交：</span>
                    <code className="rounded bg-slate-100 px-1 text-xs">
                      {syncInfo.lastCommitSha.slice(0, 7)}
                    </code>
                    {syncInfo.lastCommitMessage ? (
                      <span className="ml-2 text-slate-500">{syncInfo.lastCommitMessage}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {githubUrl ? (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  打开 GitHub
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
              >
                {showSettings ? "收起配置" : "编辑绑定"}
              </button>
              <button
                type="button"
                onClick={handleSync}
                disabled={loading}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {loading ? "同步中…" : "同步 Git 更新"}
              </button>
            </div>
          </div>

          {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <ul className="mt-4 divide-y divide-slate-100">
            {activities.length === 0 ? (
              <li className="py-4 text-sm text-slate-500">暂无提交记录，点击同步拉取</li>
            ) : (
              activities.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <code className="rounded bg-slate-100 px-1 text-slate-600">{item.shortSha}</code>
                    <span>{item.author}</span>
                    <span>{formatTime(item.committedAt)}</span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-sm font-medium text-slate-800 hover:text-indigo-600"
                  >
                    {item.message}
                  </a>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <h2 className="text-lg font-semibold text-slate-800">Git 仓库未绑定</h2>
          <p className="mt-1 text-sm text-slate-500">绑定后可在此同步 commit、驱动任务完成检测。</p>
        </section>
      )}

      {showSettings || !hasRepo ? <StudioGitSettings project={project} /> : null}
    </div>
  );
}
