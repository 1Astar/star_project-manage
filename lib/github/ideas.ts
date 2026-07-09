import { parseRepoFullName } from "@/lib/github/client";

export interface GitHubIssue {
  number: number;
  html_url: string;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<{ name: string }>;
  created_at: string;
  updated_at: string;
}

function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("未配置 GITHUB_TOKEN 环境变量");
  return token;
}

export function getIdeasRepoFullName(): string {
  return process.env.STUDIO_IDEAS_REPO?.trim() || "1Astar/star_project-manage";
}

async function githubFetch(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getGitHubToken()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API 错误 (${res.status})：${text.slice(0, 300)}`);
  }
  return res;
}

export async function createIdeaGitHubIssue(input: {
  title: string;
  body: string;
  labels: string[];
}): Promise<GitHubIssue> {
  const repo = getIdeasRepoFullName();
  const { owner, repo: name } = parseRepoFullName(repo);
  const res = await githubFetch(`/repos/${owner}/${name}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      body: input.body,
      labels: input.labels,
    }),
  });
  return (await res.json()) as GitHubIssue;
}

export async function fetchIdeaGitHubIssues(state: "open" | "closed" | "all" = "open") {
  const repo = getIdeasRepoFullName();
  const { owner, repo: name } = parseRepoFullName(repo);
  const issues: GitHubIssue[] = [];
  let page = 1;

  while (page <= 5) {
    const url = new URL(`https://api.github.com/repos/${owner}/${name}/issues`);
    url.searchParams.set("state", state);
    url.searchParams.set("labels", "type:idea");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const res = await githubFetch(url.pathname + url.search);
    const batch = (await res.json()) as GitHubIssue[];
    const filtered = batch.filter((issue) => !("pull_request" in issue));
    issues.push(...filtered);
    if (batch.length < 100) break;
    page++;
  }

  return issues;
}
