"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GitActivity, Project } from "@/lib/types";

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

export function ProjectGitPanel({
  project,
  activities: initialActivities,
}: {
  project: Project;
  activities: GitActivity[];
}) {
  const router = useRouter();
  const [activities, setActivities] = useState(initialActivities);
  const [syncInfo, setSyncInfo] = useState({
    lastSyncedAt: project.last_git_synced_at,
    lastCommitSha: project.last_commit_sha,
    lastCommitMessage: project.last_commit_message,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasRepo = Boolean(project.repo_full_name && project.repo_branch);
  const githubUrl =
    project.repo_url ??
    (project.repo_full_name ? `https://github.com/${project.repo_full_name}` : null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/github/sync?projectId=${encodeURIComponent(project.id)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "同步失败");
      }
      setSyncInfo({
        lastSyncedAt: data.syncedAt,
        lastCommitSha: data.latest?.sha ?? syncInfo.lastCommitSha,
        lastCommitMessage: data.latest?.message ?? syncInfo.lastCommitMessage,
      });
      setMessage(
        data.newCount > 0
          ? `新增 ${data.newCount} 条提交记录`
          : "已是最新，无新增提交"
      );
      if (Array.isArray(data.activities)) {
        setActivities(data.activities);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "同步失败");
    } finally {
      setLoading(false);
    }
  }

  if (!hasRepo) {
    return (
      <section className="card p-6">
        <h2 className="text-lg font-semibold">最近 Git 更新</h2>
        <p className="mt-2 text-sm text-slate-500">
          该项目尚未绑定 GitHub 仓库。可在数据库或 seed 中配置{" "}
          <code className="rounded bg-slate-100 px-1">repo_full_name</code> 与{" "}
          <code className="rounded bg-slate-100 px-1">repo_branch</code>。
        </p>
      </section>
    );
  }

  const displayActivities = activities.slice(0, 5);

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">最近 Git 更新</h2>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            <div>
              <span className="text-slate-400">仓库：</span>
              {project.repo_full_name}
            </div>
            <div>
              <span className="text-slate-400">分支：</span>
              {project.repo_branch}
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
            onClick={handleSync}
            disabled={loading}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "同步中…" : "同步 Git 更新"}
          </button>
        </div>
      </div>

      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <ul className="mt-4 divide-y divide-slate-100">
        {displayActivities.length === 0 ? (
          <li className="py-4 text-sm text-slate-500">暂无提交记录，点击「同步 Git 更新」拉取</li>
        ) : (
          displayActivities.map((item) => (
            <li key={item.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <code className="rounded bg-slate-100 px-1 text-slate-600">{item.short_sha}</code>
                <span>{item.author}</span>
                <span>{formatTime(item.committed_at)}</span>
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-sm font-medium text-slate-800 hover:text-blue-600"
              >
                {item.message}
              </a>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
