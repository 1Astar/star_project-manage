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

export function parseRepoFullName(repoFullName: string): { owner: string; repo: string } {
  const parts = repoFullName.trim().split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`仓库格式无效：${repoFullName}，应为 owner/repo`);
  }
  return { owner: parts[0], repo: parts[1] };
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

export function buildRepoUrl(repoFullName: string): string {
  return `https://github.com/${repoFullName}`;
}
