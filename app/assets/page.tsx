import { WorkbenchShell } from "@/components/workbench-shell";
import {
  AssetsLibraryClient,
  GLOBAL_FILTER,
} from "@/components/assets-library-client";
import { getAllAssets, getAllProjects, getProjectTitle } from "@/lib/studio/data";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectFilter } = await searchParams;
  const [assets, projects] = await Promise.all([getAllAssets(), getAllProjects()]);

  const scoped =
    projectFilter && projectFilter !== GLOBAL_FILTER
      ? assets.filter((asset) => asset.projectId === projectFilter)
      : assets;

  const rows = await Promise.all(
    scoped.map(async (asset) => ({
      asset,
      projectName: await getProjectTitle(asset.projectId),
    }))
  );

  const projectOptions = projects.map((p) => ({ id: p.id, label: p.title }));

  return (
    <WorkbenchShell
      title="资料 / 链接"
      subtitle="项目资料可搜索 · 全局模板单独入口 · 类型筛选"
    >
      <AssetsLibraryClient
        rows={rows}
        projects={projectOptions}
        projectFilter={projectFilter ?? null}
      />
    </WorkbenchShell>
  );
}
