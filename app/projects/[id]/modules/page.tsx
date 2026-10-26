import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-button";
import { ProductModuleList } from "@/components/product-module-list";
import { buildProductModuleSummaries } from "@/lib/modules/product-module-home";
import { loadModuleHomeBundle } from "@/lib/modules/load-module-home-data";
import { resolveProjectRoute } from "@/lib/project-bridge";

export default async function ProjectModulesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmProject && !ctx.pmSlug) notFound();

  const bundle = await loadModuleHomeBundle(ctx);
  if (!bundle) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-base font-semibold text-slate-900">产品模块</h2>
        <p className="mt-2 text-sm text-slate-600">
          当前项目「{ctx.studio?.title ?? id}」尚未接入 PM 需求库，暂无模块主页。
        </p>
        <BackLink
          fallback={`/projects/${ctx.routeId}/overview`}
          label="← 返回总览"
          className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
        />
      </div>
    );
  }

  const modules = buildProductModuleSummaries({
    routeId: ctx.routeId,
    studioProjectId: ctx.studio?.id ?? null,
    featureModules: ctx.studio?.featureModules ?? null,
    githubRepo: ctx.studio?.githubRepo ?? null,
    customFields: ctx.studio?.customFields ?? null,
    learnings: bundle.learnings,
    bugs: bundle.bugs,
    competitors: bundle.competitors,
    prds: bundle.prds,
    requirements: bundle.requirements,
    modules: bundle.modules,
  });

  return (
    <ProductModuleList
      projectSlug={ctx.pmSlug ?? bundle.project.slug}
      modules={modules}
    />
  );
}
