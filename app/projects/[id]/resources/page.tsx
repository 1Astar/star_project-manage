import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceCenter } from "@/components/studio/resource-center";
import { StudioBadge, BodySection } from "@/components/studio/shell";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { getProjectAssets, getProjectIdeas, getProjectReleases } from "@/lib/studio/data";
import { IDEA_TYPE_LABELS } from "@/lib/studio/types";
import { listProjectAttachments } from "@/lib/db/local-store";

export default async function ProjectResourcesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmBundle) notFound();

  const assets = ctx.studio ? await getProjectAssets(ctx.studio.id) : [];
  const releases = ctx.studio ? await getProjectReleases(ctx.studio.id) : [];
  const ideas = ctx.studio ? await getProjectIdeas(ctx.studio.id) : [];
  const reqAttachments = ctx.pmSlug
    ? await listProjectAttachments(ctx.pmBundle?.project.id ?? ctx.pmSlug)
    : [];

  return (
    <div className="space-y-8">
      {ctx.studio ? (
        <ResourceCenter project={ctx.studio} assets={assets} releases={releases} />
      ) : (
        <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          该项目尚未关联 Studio 项目，暂无资源中心。可在项目概况里补绑仓库与演示链接。
        </section>
      )}

      {ctx.studio ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">设计方向</h2>
          <p className="mt-2 text-sm text-slate-600">
            UI 风格与组件方向参考
            <Link href="/ui-preview" className="ml-2 text-indigo-600 hover:underline">
              打开 UI 方向预览 →
            </Link>
          </p>
        </section>
      ) : null}

      {ctx.studio?.body.links ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <BodySection title="相关链接" content={ctx.studio.body.links} />
        </section>
      ) : null}

      {reqAttachments.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">附件库 · 需求附图</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {reqAttachments.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-indigo-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.title} className="h-32 w-full object-cover" />
                <div className="truncate px-2 py-1.5 text-xs text-slate-600">{a.title}</div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

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
