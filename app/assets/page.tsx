import Link from "next/link";
import { WorkbenchShell } from "@/components/workbench-shell";
import { ListFilterBar } from "@/components/studio/list-filter-bar";
import { StudioBadge } from "@/components/studio/shell";
import { getAllAssets, getAllProjects, getProjectTitle } from "@/lib/studio/data";
import { ASSET_TYPE_LABELS } from "@/lib/studio/types";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectFilter } = await searchParams;
  const [assets, projects] = await Promise.all([getAllAssets(), getAllProjects()]);

  const filteredAssets = projectFilter
    ? assets.filter((asset) => asset.projectId === projectFilter)
    : assets;

  const assetsWithProject = await Promise.all(
    filteredAssets.map(async (asset) => ({
      asset,
      projectName: await getProjectTitle(asset.projectId),
    }))
  );

  const projectOptions = projects.map((p) => ({ id: p.id, label: p.title }));

  return (
    <WorkbenchShell title="资料 / 链接" subtitle="竞品 · UI 参考 · 技术文档 · 设计方向">
      <ListFilterBar
        basePath="/assets"
        currentValue={projectFilter ?? null}
        options={projectOptions}
        allLabel="全部项目"
        label="按项目"
      />

      {assetsWithProject.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          {projectFilter ? "该项目暂无资料" : "暂无资料，可在项目「资料链接」Tab 查看"}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assetsWithProject.map(({ asset, projectName }) => (
            <article
              key={asset.id}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StudioBadge>{ASSET_TYPE_LABELS[asset.assetType]}</StudioBadge>
                <Link
                  href={`/projects/${asset.projectId}/resources`}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  {projectName}
                </Link>
              </div>
              <h2 className="mt-2 font-semibold text-slate-900">{asset.title}</h2>
              {asset.note ? <p className="mt-1 text-sm text-slate-600">{asset.note}</p> : null}
              {asset.url ? (
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-sm text-indigo-600 hover:underline"
                >
                  打开链接 →
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </WorkbenchShell>
  );
}
