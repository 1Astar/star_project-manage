import { buildRepoUrl } from "@/lib/github/client";
import type { Project } from "@/lib/studio/types";

export interface StudioGitActivity {
  id: string;
  projectId: string;
  repoFullName: string;
  branch: string;
  commitSha: string;
  shortSha: string;
  message: string;
  author: string;
  committedAt: string;
  url: string;
  syncedAt: string;
}

export interface ProjectGitScope {
  repoFullName: string;
  branch: string;
  /** 仓库内相对路径；有值时 GitHub commits?path= 只返回影响该目录的提交 */
  path?: string;
}

/** 将本地/Windows 路径收成 GitHub API 可用的仓库相对 path */
export function normalizeRepoRelativePath(codePath: string | null | undefined): string | undefined {
  if (!codePath?.trim()) return undefined;

  let p = codePath.trim().replace(/\\/g, "/");

  // 误填仓库 URL / http(s) → 不当作 path（否则 GitHub path= 过滤必空）
  if (/^https?:\/\//i.test(p) || /^github\.com\//i.test(p)) {
    return undefined;
  }

  p = p.replace(/^[A-Za-z]:/, "");
  p = p.replace(/^\/+/, "");

  // 从已知 monorepo 根截断（避免 E:/foo/工具/... 整段塞进 path）
  const markers = ["工具/", "tools/", "packages/", "apps/", "services/"];
  for (const marker of markers) {
    const idx = p.indexOf(marker);
    if (idx >= 0) {
      p = p.slice(idx);
      break;
    }
  }

  // 纯本机绝对路径（如 Users/.../projects/moonpie）= 仓库根，不按子目录过滤
  if (/^(Users|home|Documents|Desktop|projects)\//i.test(p)) {
    return undefined;
  }

  p = p.replace(/^\/+|\/+$/g, "");
  return p || undefined;
}

/**
 * 用项目上的 githubBranch + codePath，不再默认 main。
 * 未配分支 / 仓库则抛错。
 */
export function resolveProjectGitScope(project: Project): ProjectGitScope {
  const repoFullName = project.githubRepo?.trim();
  if (!repoFullName) {
    throw new Error("项目未配置 GitHub 仓库（githubRepo）");
  }
  const branch = project.githubBranch?.trim();
  if (!branch) {
    throw new Error("项目未配置分支（githubBranch），请在项目 Git 设置中填写");
  }
  return {
    repoFullName,
    branch,
    path: normalizeRepoRelativePath(project.codePath),
  };
}

export function studioProjectHasGit(project: Project) {
  return Boolean(project.githubRepo?.trim() && project.githubBranch?.trim());
}

export function studioProjectRepoUrl(project: Project) {
  return project.githubRepo ? buildRepoUrl(project.githubRepo) : null;
}
