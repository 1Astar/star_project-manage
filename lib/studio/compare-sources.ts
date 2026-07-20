import { readFile } from "fs/promises";
import path from "path";
import { parseRepoFullName } from "@/lib/github/client";
import { getProjectById } from "@/lib/studio/data";

export type SourceSnapshot = {
  source: "git" | "vercel" | "studio";
  sha: string | null;
  at: string | null;
  label: string;
  detail?: string;
};

export type CompareSourcesResult = {
  projectId: string;
  projectTitle: string;
  sources: SourceSnapshot[];
  newest: "git" | "vercel" | "studio" | "unknown" | "tie";
  diverged: boolean;
  advice: string;
  warnings: string[];
};

async function fetchGitHubTip(
  repoFullName: string,
  branch: string
): Promise<{ sha: string; date: string; message: string } | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  const { owner, repo } = parseRepoFullName(repoFullName);
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: 0 },
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    sha?: string;
    commit?: { message?: string; committer?: { date?: string }; author?: { date?: string } };
  };
  const sha = data.sha ?? null;
  if (!sha) return null;
  return {
    sha,
    date: data.commit?.committer?.date || data.commit?.author?.date || "",
    message: (data.commit?.message ?? "").split("\n")[0] ?? "",
  };
}

async function fetchVercelProductionTip(
  vercelUrl: string | null
): Promise<{ sha: string | null; at: string | null; url: string | null; detail: string } | null> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return {
      sha: null,
      at: null,
      url: vercelUrl,
      detail: "未配置 VERCEL_TOKEN，无法拉取 production 部署 sha",
    };
  }

  const params = new URLSearchParams({ target: "production", limit: "1" });
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  if (projectId) params.set("projectId", projectId);
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (teamId) params.set("teamId", teamId);

  // 无 projectId 时尝试用 URL 主机名当 app 过滤（弱匹配）
  if (!projectId && vercelUrl) {
    try {
      const host = new URL(vercelUrl).hostname.replace(/\.vercel\.app$/i, "");
      if (host) params.set("app", host.split(".")[0] ?? host);
    } catch {
      /* ignore */
    }
  }

  const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = await res.text();
    return {
      sha: null,
      at: null,
      url: vercelUrl,
      detail: `Vercel API ${res.status}: ${body.slice(0, 120)}`,
    };
  }
  const data = (await res.json()) as {
    deployments?: Array<{
      uid?: string;
      url?: string;
      created?: number;
      meta?: { githubCommitSha?: string; gitCommitSha?: string };
    }>;
  };
  const dep = data.deployments?.[0];
  if (!dep) {
    return { sha: null, at: null, url: vercelUrl, detail: "无 production 部署记录" };
  }
  const sha = dep.meta?.githubCommitSha || dep.meta?.gitCommitSha || null;
  const at = dep.created ? new Date(dep.created).toISOString() : null;
  return {
    sha,
    at,
    url: dep.url ? `https://${dep.url}` : vercelUrl,
    detail: sha ? `production ${sha.slice(0, 7)}` : "production 无 commit sha 元数据",
  };
}

function pickNewest(
  items: Array<{ key: "git" | "vercel" | "studio"; at: string | null }>
): CompareSourcesResult["newest"] {
  const dated = items
    .filter((i) => i.at)
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  if (!dated.length) return "unknown";
  if (dated.length >= 2 && dated[0].at === dated[1].at) return "tie";
  return dated[0].key;
}

/** 读取仓库内 canonical 规则正文 */
export async function loadCanonicalAiRules(): Promise<{ path: string; content: string }> {
  const rel = "docs/ai/CANONICAL_RULES.md";
  const abs = path.join(process.cwd(), rel);
  const content = await readFile(abs, "utf8");
  return { path: rel, content };
}

export async function compareProjectSources(projectId: string): Promise<CompareSourcesResult> {
  const project = await getProjectById(projectId);
  if (!project) throw new Error("项目不存在");

  const warnings: string[] = [];
  const sources: SourceSnapshot[] = [];

  const branch = project.githubBranch?.trim() || "main";
  if (project.githubRepo?.trim()) {
    try {
      const tip = await fetchGitHubTip(project.githubRepo, branch);
      if (tip) {
        sources.push({
          source: "git",
          sha: tip.sha,
          at: tip.date || null,
          label: `${project.githubRepo}@${branch}`,
          detail: tip.message,
        });
      } else {
        warnings.push("无法读取 GitHub tip（检查 GITHUB_TOKEN / 仓库权限）");
        sources.push({
          source: "git",
          sha: null,
          at: null,
          label: `${project.githubRepo}@${branch}`,
          detail: "不可用",
        });
      }
    } catch (e) {
      warnings.push(e instanceof Error ? e.message : "Git 查询失败");
    }
  } else {
    warnings.push("项目未配置 githubRepo");
  }

  const vercel = await fetchVercelProductionTip(project.vercelUrl);
  if (vercel) {
    sources.push({
      source: "vercel",
      sha: vercel.sha,
      at: vercel.at,
      label: "Vercel production",
      detail: vercel.detail,
    });
    if (!process.env.VERCEL_TOKEN) warnings.push(vercel.detail);
  }

  sources.push({
    source: "studio",
    sha: project.lastCommitSha,
    at: project.lastCommitAt || project.lastGitSyncedAt,
    label: "Studio 已同步记录",
    detail: project.lastCommitMessage || undefined,
  });

  const newest = pickNewest(
    sources.map((s) => ({
      key: s.source,
      at: s.at,
    }))
  );

  const shas = sources.map((s) => s.sha).filter(Boolean) as string[];
  const uniqueShas = new Set(shas.map((s) => s.slice(0, 7)));
  const diverged = uniqueShas.size > 1;

  let advice = "三方信息不足，请人工确认后再改。";
  if (newest === "git" && diverged) {
    advice = "Git 侧更新：以 Git 为准 pull/对齐后再改；勿用旧本地覆盖。";
  } else if (newest === "vercel" && diverged) {
    advice = "Vercel 生产可能领先 Git：先把线上同步回 Git，再改本地。";
  } else if (newest === "studio" && diverged) {
    advice = "Studio 记录的同步点与远端不一致：先「同步 Git 更新」/核对仓库，再动手。";
  } else if (!diverged && shas.length) {
    advice = "已对齐或仅一路可用：可在当前基线上修改。";
  } else if (newest === "tie") {
    advice = "时间接近：再核 sha；有分叉则先同步。";
  }

  return {
    projectId: project.id,
    projectTitle: project.title,
    sources,
    newest,
    diverged,
    advice,
    warnings,
  };
}
