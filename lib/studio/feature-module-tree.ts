import type { Project } from "@/lib/studio/types";
import type { ModuleNode } from "@/lib/types";
import {
  normalizeFeaturePath,
  parseFeaturePathToChain,
} from "@/lib/studio/project-modules";

export type ModuleTreeSyncResult = {
  /** 新建节点总数（任意层） */
  created: number;
  skippedExisting: number;
  paths: number;
  /** 兼容旧 toast：新建的一级节点数 */
  createdL1: number;
  /** 兼容旧 toast：新建的二级及以下节点数 */
  createdL2: number;
};

/**
 * 把功能板块名单增量同步到 PM 模块树（任意多层）。
 * 路径按 · / 、 分段；同名同父跳过；不删除名单外已有模块。
 */
export async function syncFeatureModulesToModuleTree(
  studioProject: Project,
  paths: string[]
): Promise<ModuleTreeSyncResult> {
  const { getPmSlugForStudioProject } = await import("@/lib/project-bridge");
  const {
    ensurePmProjectForStudio,
    listProjectModules,
    createProjectModule,
  } = await import("@/lib/db/local-store");

  const slug = getPmSlugForStudioProject(studioProject);
  const pm = await ensurePmProjectForStudio({
    slug,
    name: studioProject.title,
    description: studioProject.positioning || null,
    demo_url: studioProject.demoUrl,
    local_run_guide: studioProject.localRunGuide,
    code_path: studioProject.codePath,
    repo_full_name: studioProject.githubRepo,
    repo_branch: studioProject.githubBranch || null,
    repo_url: studioProject.githubRepo
      ? `https://github.com/${studioProject.githubRepo}`
      : null,
  });

  const cleaned = Array.from(
    new Set(
      paths
        .map((p) => normalizeFeaturePath(p.trim()))
        .filter(Boolean)
    )
  );

  const result: ModuleTreeSyncResult = {
    created: 0,
    skippedExisting: 0,
    paths: cleaned.length,
    createdL1: 0,
    createdL2: 0,
  };
  if (cleaned.length === 0) return result;

  const modules = await listProjectModules(pm.id);
  /** parentId|null + name → node */
  const byParentName = new Map<string, ModuleNode>();
  for (const m of modules) {
    byParentName.set(`${m.parent_id ?? ""}::${m.name}`, m);
  }

  for (const path of cleaned) {
    const chain = parseFeaturePathToChain(path);
    if (chain.length === 0) continue;

    let parentId: string | null = null;
    let pathFullyExisted = true;

    for (let i = 0; i < chain.length; i++) {
      const name = chain[i];
      const key = `${parentId ?? ""}::${name}`;
      let node = byParentName.get(key);
      if (!node) {
        node = await createProjectModule({
          projectId: pm.id,
          name,
          parentId,
        });
        byParentName.set(key, node);
        result.created += 1;
        if (i === 0) result.createdL1 += 1;
        else result.createdL2 += 1;
        pathFullyExisted = false;
      }
      parentId = node.id;
    }

    if (pathFullyExisted) result.skippedExisting += 1;
  }

  return result;
}

/** @deprecated use parseFeaturePathToChain */
export function parseFeaturePathToLevels(path: string): {
  l1: string;
  l2: string | null;
} | null {
  const chain = parseFeaturePathToChain(path);
  if (chain.length === 0) return null;
  if (chain.length === 1) return { l1: chain[0], l2: null };
  return { l1: chain[0], l2: chain.slice(1).join("·") };
}
