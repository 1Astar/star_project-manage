export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
}

function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("未配置 GITHUB_TOKEN 环境变量");
  }
  return token;
}

/**
 * 把 GitHub 仓库输入归一为 owner/repo。
 * 接受：owner/repo、https://github.com/owner/repo(.git)、git@github.com:owner/repo.git
 */
export function normalizeGithubRepoFullName(input: string): string {
  let raw = input.trim();
  if (!raw) return "";

  raw = raw.replace(/^git\+/i, "");

  const ssh = raw.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (ssh) return `${ssh[1]}/${ssh[2]}`;

  raw = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  if (/^github\.com\//i.test(raw)) {
    raw = raw.replace(/^github\.com\//i, "");
  }

  raw = raw.replace(/\.git$/i, "").replace(/\/+$/, "");
  // 去掉多余 path（/tree/main 等）
  const parts = raw.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return raw;
}

export function parseRepoFullName(repoFullName: string): { owner: string; repo: string } {
  const normalized = normalizeGithubRepoFullName(repoFullName);
  const parts = normalized.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`仓库格式无效：${repoFullName}，应为 owner/repo 或 GitHub URL`);
  }
  return { owner: parts[0], repo: parts[1] };
}

export function buildRepoUrl(repoFullName: string): string {
  const { owner, repo } = parseRepoFullName(repoFullName);
  return `https://github.com/${owner}/${repo}`;
}

export async function fetchRecentCommits(
  repoFullName: string,
  branch: string,
  perPage = 10,
  path?: string
): Promise<GitHubCommit[]> {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
  url.searchParams.set("sha", branch);
  url.searchParams.set("per_page", String(perPage));
  if (path?.trim()) {
    url.searchParams.set("path", path.trim().replace(/\\/g, "/"));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getGitHubToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API 错误 (${res.status})：${body.slice(0, 200)}`);
  }

  return (await res.json()) as GitHubCommit[];
}

export interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
}

export interface GitHubTag {
  name: string;
  commit: { sha: string; url: string };
}

async function githubFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getGitHubToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API 错误 (${res.status})：${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** 拉取非 draft 的 Release（最新 50） */
export async function fetchGitHubReleases(
  repoFullName: string,
  perPage = 50
): Promise<GitHubRelease[]> {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/releases`);
  url.searchParams.set("per_page", String(perPage));
  const all = await githubFetch<GitHubRelease[]>(url.toString());
  return all.filter((r) => !r.draft);
}

/** 拉取 Tag 列表（最新 50），用于补无 Release 的 Tag */
export async function fetchGitHubTags(
  repoFullName: string,
  perPage = 50
): Promise<GitHubTag[]> {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/tags`);
  url.searchParams.set("per_page", String(perPage));
  return githubFetch<GitHubTag[]>(url.toString());
}

/** 单个 commit 元信息（取作者时间） */
export async function fetchCommitDate(
  repoFullName: string,
  sha: string
): Promise<string | null> {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const data = await githubFetch<{
    commit?: { author?: { date?: string }; committer?: { date?: string } };
  }>(`https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(sha)}`);
  return data.commit?.author?.date ?? data.commit?.committer?.date ?? null;
}

/** base...head 之间的 commits（不含 base，含 head） */
export async function fetchCompareCommits(
  repoFullName: string,
  base: string,
  head: string
): Promise<GitHubCommit[]> {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const url = `https://api.github.com/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
  const data = await githubFetch<{ commits?: GitHubCommit[] }>(url);
  return data.commits ?? [];
}

export type CreateGitHubReleaseInput = {
  tag: string;
  name?: string;
  body?: string;
  /** 若 tag 尚不存在，用该 commitish 创建（分支名或 sha） */
  targetCommitish?: string;
  draft?: boolean;
  prerelease?: boolean;
  generateReleaseNotes?: boolean;
};

/** 创建 GitHub Release（tag 已存在或一并指定 target_commitish） */
export async function createGitHubRelease(
  repoFullName: string,
  input: CreateGitHubReleaseInput
): Promise<GitHubRelease> {
  const { owner, repo } = parseRepoFullName(repoFullName);
  const payload: Record<string, unknown> = {
    tag_name: input.tag,
    name: input.name || input.tag,
    body: input.body ?? "",
    draft: Boolean(input.draft),
    prerelease: Boolean(input.prerelease),
  };
  if (input.targetCommitish) payload.target_commitish = input.targetCommitish;
  if (input.generateReleaseNotes) payload.generate_release_notes = true;

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getGitHubToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`创建 Release 失败 (${res.status})：${body.slice(0, 300)}`);
  }
  return (await res.json()) as GitHubRelease;
}
