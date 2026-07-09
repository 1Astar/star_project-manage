import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioBadge, BodySection } from "@/components/studio/shell";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { getProjectAssets, getProjectIdeas } from "@/lib/studio/data";
import { ASSET_TYPE_LABELS, IDEA_TYPE_LABELS } from "@/lib/studio/types";

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
        <h2 className="mb-3 text-sm font-semibold text-slate-700">资料库</h2>
        {assets.length === 0 ? (
          <p className="text-sm text-slate-500">暂无资料，可在全局「资料 / 链接」页查看全部。</p>
        ) : (
          <ul className="space-y-3">
            {assets.map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                <div className="flex items-center gap-2">
                  <StudioBadge>{ASSET_TYPE_LABELS[a.assetType]}</StudioBadge>
                  <a href={a.url} className="font-medium text-indigo-600 hover:underline" target="_blank" rel="noreferrer">
                    {a.title}
                  </a>
                </div>
                {a.takeaway ? <p className="mt-1 text-slate-500">可借鉴：{a.takeaway}</p> : null}
              </li>
            ))}
          </ul>
        )}
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
