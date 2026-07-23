import type { Project } from "@/lib/studio/types";
import type { ModuleNode } from "@/lib/types";

/** 将「体系·功能面·能力」路径拆成模块树两级：首段 L1，其余拼成 L2 */
export function parseFeaturePathToLevels(
  path: string
): { l1: string; l2: string | null } | null {
  const parts = path
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return { l1: parts[0], l2: null };
  return { l1: parts[0], l2: parts.slice(1).join("·") };
}

export type ModuleTreeSyncResult = {
  createdL1: number;
  createdL2: number;
  skippedExisting: number;
  paths: number;
};

/**
 * 把功能板块名单增量同步到 PM 模块树（最多两级）。
 * 已存在同名节点跳过；不删除名单外已有模块。
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

  const cleaned = Array.from(new Set(paths.map((p) => p.trim()).filter(Boolean)));

  const result: ModuleTreeSyncResult = {
    createdL1: 0,
    createdL2: 0,
    skippedExisting: 0,
    paths: cleaned.length,
  };
  if (cleaned.length === 0) return result;

  const modules = await listProjectModules(pm.id);
  const l1ByName = new Map<string, ModuleNode>();
  const l2Key = new Set<string>();

  for (const m of modules) {
    if (m.level === 1 && !m.parent_id) {
      l1ByName.set(m.name, m);
    } else if (m.level === 2 && m.parent_id) {
      l2Key.add(`${m.parent_id}::${m.name}`);
    }
  }

  for (const path of cleaned) {
    const levels = parseFeaturePathToLevels(path);
    if (!levels) continue;

    let l1 = l1ByName.get(levels.l1);
    let l1Created = false;
    if (!l1) {
      l1 = await createProjectModule({ projectId: pm.id, name: levels.l1 });
      l1ByName.set(levels.l1, l1);
      result.createdL1 += 1;
      l1Created = true;
    }

    if (!levels.l2) {
      if (!l1Created) result.skippedExisting += 1;
      continue;
    }

    const key = `${l1.id}::${levels.l2}`;
    if (l2Key.has(key)) {
      result.skippedExisting += 1;
      continue;
    }
    await createProjectModule({
      projectId: pm.id,
      name: levels.l2,
      parentId: l1.id,
    });
    l2Key.add(key);
    result.createdL2 += 1;
  }

  return result;
}
