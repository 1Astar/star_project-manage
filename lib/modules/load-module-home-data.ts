import { listCompetitorEntries } from "@/lib/competitors/store";
import {
  getPoolBundle,
  listBugsByProject,
  listProjectModules,
} from "@/lib/db/local-store";
import { listProjectLearningNotes } from "@/lib/learning-notes/store";
import { listProjectPrds } from "@/lib/prds/store";
import type { ResolveProjectRouteResult } from "@/lib/project-bridge";
import { listProjectWikiPages } from "@/lib/wiki-pages/store";

/** 模块主页轻量数据包（对齐总览，避免整板） */
export async function loadModuleHomeBundle(ctx: ResolveProjectRouteResult) {
  const project = ctx.pmProject;
  if (!project) return null;

  const [learnings, bugs, competitors, prds, modules, pool, wikiPages] =
    await Promise.all([
      listProjectLearningNotes(project.id),
      listBugsByProject(project.id),
      listCompetitorEntries(project.id),
      listProjectPrds(project.id),
      listProjectModules(project.id),
      getPoolBundle(project.id),
      listProjectWikiPages(project.id),
    ]);

  return {
    project,
    learnings,
    bugs,
    competitors,
    prds,
    modules,
    requirements: pool?.poolRequirements ?? [],
    wikiPages,
  };
}
