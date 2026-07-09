import Link from "next/link";
import { WorkbenchShell } from "@/components/workbench-shell";
import { StudioBadge } from "@/components/studio/shell";
import { getAllAssets, getProjectTitle } from "@/lib/studio/data";
import { ASSET_TYPE_LABELS } from "@/lib/studio/types";

export default async function AssetsPage() {
  const assets = await getAllAssets();

  const assetsWithProject = await Promise.all(
    assets.map(async (asset) => ({
      asset,
      projectName: await getProjectTitle(asset.projectId),
    }))
  );

  return (
    <WorkbenchShell title="资料 / 链接" subtitle="竞品 · UI 参考 · 技术文档 · 设计方向">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        {assets.length === 0 ? (
          <p className="text-sm text-slate-500">暂无资料，可在项目详情「资料链接」Tab 添加</p>
        ) : null}
      </div>
    </WorkbenchShell>
  );
}
