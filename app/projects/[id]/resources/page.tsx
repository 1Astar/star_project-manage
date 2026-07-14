import Link from "next/link";
import { notFound } from "next/navigation";
import { AddAssetForm } from "@/components/studio/add-asset-form";
import { ProjectAssetsTable } from "@/components/studio/project-assets-table";
import { StudioBadge, BodySection } from "@/components/studio/shell";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { getProjectAssets, getProjectIdeas } from "@/lib/studio/data";
import { IDEA_TYPE_LABELS } from "@/lib/studio/types";

export default async function ProjectResourcesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio) notFound();

  const [assets, ideas] = await Promise.all([
    getProjectAssets(ctx.studio.id),
    getProjectIdeas(ctx.studio.id),
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-700">设计方向</h2>
        <p className="mt-2 text-sm text-slate-600">
          UI 风格与组件方向参考
          <Link href="/ui-preview" className="ml-2 text-indigo-600 hover:underline">
            打开 UI 方向预览 →
          </Link>
        </p>
      </section>

      {ctx.studio.body.links ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <BodySection title="相关链接" content={ctx.studio.body.links} />
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">资料库</h2>
          <AddAssetForm projectId={ctx.studio.id} />
        </div>
        <ProjectAssetsTable assets={assets} />
      </section>

      {ideas.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">关联灵感</h2>
          <ul className="space-y-2">
            {ideas.map((i) => (
              <li key={i.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <span className="font-medium">{i.title}</span>
                <StudioBadge>{IDEA_TYPE_LABELS[i.type]}</StudioBadge>
                <p className="mt-1 text-slate-500">{i.oneLineIdea}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
