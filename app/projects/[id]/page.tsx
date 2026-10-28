import { notFound } from "next/navigation";
import Link from "next/link";
import { ProjectHubView } from "@/components/project-hub-view";
import { getAdminSession } from "@/lib/auth/session";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { buildProductModuleSummaries } from "@/lib/modules/product-module-home";
import { resolveProjectHubMd } from "@/lib/modules/project-hub";
import { loadModuleHomeBundle } from "@/lib/modules/load-module-home-data";
import {
  buildLinkedViewLibraryRows,
  EMPTY_LINKED_VIEW_LIBRARIES,
} from "@/lib/linked-views/build-libraries";

export default async function ProjectHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmProject && !ctx.pmSlug) notFound();

  const session = await getAdminSession();
  const canEdit = session?.role === "admin" && Boolean(ctx.studio?.id);
  const title = ctx.studio?.title ?? ctx.pmProject?.name ?? ctx.pmSlug ?? id;
  const projectSlug = ctx.pmSlug ?? ctx.pmProject?.slug ?? ctx.routeId;

  const hub = resolveProjectHubMd({
    customFields: ctx.studio?.customFields ?? null,
    title,
    positioning: ctx.studio?.positioning ?? ctx.pmProject?.description,
    targetUser: ctx.studio?.targetUser,
    currentStage: ctx.studio?.currentStage,
    nextAction: ctx.studio?.nextAction,
  });

  const bundle = await loadModuleHomeBundle(ctx);
  const libraries = bundle
    ? buildLinkedViewLibraryRows({
        routeId: ctx.routeId,
        learnings: bundle.learnings,
        bugs: bundle.bugs,
        competitors: bundle.competitors,
        prds: bundle.prds,
        requirements: bundle.requirements,
        modules: bundle.modules,
        slimPeek: true,
      })
    : EMPTY_LINKED_VIEW_LIBRARIES;
  const modules = bundle
    ? buildProductModuleSummaries({
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
        wikiPages: bundle.wikiPages,
      })
    : [];

  const base = `/projects/${projectSlug}`;
  const workLinks = [
    { label: "总览", href: `${base}/overview` },
    { label: "模块", href: `${base}/modules` },
    { label: "学习池", href: `${base}/learning` },
    { label: "竞品", href: `${base}/competitors` },
    { label: "需求与任务", href: `${base}/tasks` },
    { label: "Bug", href: `${base}/bugs` },
    { label: "项目恢复", href: `${base}/recovery` },
  ];

  return (
    <div className="space-y-4">
      <ProjectHubView
        projectId={bundle?.project.id ?? ctx.pmProject?.id ?? null}
        projectSlug={projectSlug}
        studioProjectId={ctx.studio?.id ?? null}
        title={title}
        initialMd={hub.md}
        isDefault={hub.isDefault}
        modules={modules}
        canEdit={canEdit}
        workLinks={workLinks}
        libraries={libraries}
      />
      {!ctx.studio ? (
        <p className="mx-auto max-w-3xl text-xs text-slate-400">
          当前项目未挂 Studio，Hub 正文暂不可保存；仍可点模块导航。
          <Link href={`${base}/recovery`} className="ml-1 text-indigo-600 hover:underline">
            打开项目恢复
          </Link>
        </p>
      ) : null}
    </div>
  );
}
