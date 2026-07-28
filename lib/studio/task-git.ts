import { fetchRecentCommits, type GitHubCommit } from "@/lib/github/client";
import { resolveProjectGitScope } from "@/lib/studio/git-utils";
import { updateStudioTask } from "@/lib/studio/mutations";
import { getStudioSnapshot } from "@/lib/studio/store";
import type { Project, StudioRelease, StudioTask } from "@/lib/studio/types";

/** 长中文短语：命中 1 个即可视为完成（与人工对照 changelog/release 的习惯一致） */
export const STRONG_CJK_MIN = 4;
/** 英文/数字标识：如 ReadingFacts、Tab */
export const STRONG_LATIN_MIN = 4;

const NOISE = new Set([
  "done",
  "todo",
  "wip",
  "fix",
  "feat",
  "chore",
  "docs",
  "release",
  "优化",
  "增加",
  "新增",
  "完成",
  "支持",
  "实现",
  "调整",
  "修改",
  "更新",
  "修复",
  "打磨",
]);

export type TaskMatchPhrases = {
  /** 长中文 / 较长英文标识：命中 1 个即过 */
  strong: string[];
  /** 短词：需凑满 2 个（仅当没有 strong 可用时兜底） */
  weak: string[];
};

/** 去掉优先级/完成标记等噪声，保留可匹配的核心短语 */
export function taskMatchPhrases(title: string): TaskMatchPhrases {
  let t = title.trim();
  t = t.replace(/^\[done\]\s*/i, "");
  t = t.replace(/✅/g, " ");
  t = t.replace(/\bP[0-3]\b/gi, " ");
  // 【六爻P1】【六爻】→ 空格，内部汉字留给后面抽取
  t = t.replace(/【([^】]*)】/g, " $1 ");
  t = t.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, " ");

  const strong: string[] = [];
  const weak: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string, bucket: "strong" | "weak") => {
    const w = raw.trim();
    if (w.length < 2) return;
    const key = w.toLowerCase();
    if (seen.has(key) || NOISE.has(key)) return;
    seen.add(key);
    (bucket === "strong" ? strong : weak).push(w);
  };

  // 连续汉字块
  for (const m of t.match(/[\u4e00-\u9fa5]{2,}/g) ?? []) {
    if (m.length >= STRONG_CJK_MIN) push(m, "strong");
    else push(m, "weak");
  }
  // 拉丁标识
  for (const m of t.match(/[a-zA-Z][a-zA-Z0-9]{1,}/g) ?? []) {
    if (m.length >= STRONG_LATIN_MIN) push(m, "strong");
    else push(m, "weak");
  }

  return { strong, weak };
}

export function textMatchesTask(haystack: string, task: { id: string; title: string }): boolean {
  const text = haystack.toLowerCase();
  if (!text.trim()) return false;
  if (text.includes(task.id.toLowerCase())) return true;

  const { strong, weak } = taskMatchPhrases(task.title);
  if (strong.some((p) => text.includes(p.toLowerCase()))) return true;

  if (strong.length === 0 && weak.length > 0) {
    const hits = weak.filter((kw) => text.includes(kw.toLowerCase()));
    return hits.length >= Math.min(2, weak.length);
  }
  return false;
}

function commitMatchesTask(commit: GitHubCommit, task: StudioTask): boolean {
  return textMatchesTask(commit.commit.message, task);
}

function releaseHaystack(rel: StudioRelease): string {
  return [rel.tag, rel.name, rel.body].filter(Boolean).join("\n");
}

function releaseMatchesTask(rel: StudioRelease, task: StudioTask): boolean {
  return textMatchesTask(releaseHaystack(rel), task);
}

/**
 * 仅在「项目分支 +（可选）code_path 影响目录」的提交 + 已同步 Release/Tag body 里匹配任务。
 * 规则：任务 id，或 1 个长中文/英文标识短语；无长短语时短词需命中 ≥2。
 */
export async function syncProjectTasksFromGit(project: Project) {
  const { repoFullName, branch, path } = resolveProjectGitScope(project);

  const commits = await fetchRecentCommits(repoFullName, branch, 40, path);
  const { tasks, releases } = await getStudioSnapshot();
  const openTasks = tasks.filter((t) => t.projectId === project.id && t.status !== "done");
  const projectReleases = (releases ?? [])
    .filter((r) => r.projectId === project.id)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 40);

  const updated: Array<{
    taskId: string;
    title: string;
    commitMessage: string;
    source: "commit" | "release";
  }> = [];

  for (const task of openTasks) {
    const commitHit = commits.find((c) => commitMatchesTask(c, task));
    if (commitHit) {
      const msg = commitHit.commit.message.split("\n")[0];
      await updateStudioTask(task.id, {
        status: "done",
        completionSource: "git",
        gitCommitSha: commitHit.sha,
        gitCommitMessage: msg,
        completedAt: commitHit.commit.author?.date ?? undefined,
      });
      updated.push({
        taskId: task.id,
        title: task.title,
        commitMessage: msg,
        source: "commit",
      });
      continue;
    }

    const releaseHit = projectReleases.find((r) => releaseMatchesTask(r, task));
    if (releaseHit) {
      const msg = `Release ${releaseHit.tag}: ${(releaseHit.name || releaseHit.body.split("\n")[0] || "").slice(0, 120)}`;
      await updateStudioTask(task.id, {
        status: "done",
        completionSource: "git",
        gitCommitSha: null,
        gitCommitMessage: msg,
        completedAt: releaseHit.publishedAt ?? undefined,
      });
      updated.push({
        taskId: task.id,
        title: task.title,
        commitMessage: msg,
        source: "release",
      });
    }
  }

  return {
    matched: updated.length,
    updated,
    scope: {
      branch,
      path: path ?? null,
      commitsScanned: commits.length,
      releasesScanned: projectReleases.length,
    },
  };
}
