import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-button";
import { ProductModuleHomeView } from "@/components/product-module-home";
import { getAdminSession } from "@/lib/auth/session";
import {
  buildProductModuleHome,
  collectProductModuleNames,
  decodeModuleKey,
} from "@/lib/modules/product-module-home";
import { loadModuleHomeBundle } from "@/lib/modules/load-module-home-data";
import { buildLinkedViewLibraryRows } from "@/lib/linked-views/build-libraries";
import { resolveProjectRoute } from "@/lib/project-bridge";

export default async function ProjectModuleHomePage({
  params,
}: {
  params: Promise<{ id: string; moduleKey: string }>;
}) {
  const { id, moduleKey } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmProject && !ctx.pmSlug) notFound();

  const bundle = await loadModuleHomeBundle(ctx);
  if (!bundle) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-base font-semibold text-slate-900">模块主页</h2>
        <p className="mt-2 text-sm text-slate-600">
          当前项目尚未接入 PM，暂无模块主页。
        </p>
        <BackLink
          fallback={`/projects/${ctx.routeId}/modules`}
          label="← 返回模块列表"
          className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
        />
      </div>
    );
  }

  const moduleName = decodeModuleKey(moduleKey);
  const known = collectProductModuleNames({
    studioProjectId: ctx.studio?.id ?? null,
    featureModules: ctx.studio?.featureModules ?? null,
    githubRepo: ctx.studio?.githubRepo ?? null,
    learnings: bundle.learnings,
    bugs: bundle.bugs,
    competitors: bundle.competitors,
    prds: bundle.prds,
    requirements: bundle.requirements,
    modules: bundle.modules,
    wikiPages: bundle.wikiPages,
  });
  if (!moduleName || !known.includes(moduleName)) notFound();

  const home = buildProductModuleHome({
    routeId: ctx.routeId,
    moduleName,
    customFields: ctx.studio?.customFields ?? null,
    learnings: bundle.learnings,
    bugs: bundle.bugs,
    competitors: bundle.competitors,
    prds: bundle.prds,
    requirements: bundle.requirements,
    modules: bundle.modules,
    wikiPages: bundle.wikiPages,
  });

  const session = await getAdminSession();
  const canEditBio = session?.role === "admin" && Boolean(ctx.studio?.id);
  const canEditPages = session?.role === "admin";
  const libraries = buildLinkedViewLibraryRows({
    routeId: ctx.routeId,
    learnings: bundle.learnings,
    bugs: bundle.bugs,
    competitors: bundle.competitors,
    prds: bundle.prds,
    requirements: bundle.requirements,
    modules: bundle.modules,
  });

  return (
    <ProductModuleHomeView
      projectId={bundle.project.id}
      projectSlug={ctx.pmSlug ?? bundle.project.slug}
      studioProjectId={ctx.studio?.id ?? null}
      canEditBio={canEditBio}
      canEditPages={canEditPages}
      home={home}
      libraries={libraries}
    />
  );
}
