import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-button";
import { WikiPageView } from "@/components/wiki-page-view";
import { getAdminSession } from "@/lib/auth/session";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { loadModuleHomeBundle } from "@/lib/modules/load-module-home-data";
import {
  buildLinkedViewLibraryRows,
  EMPTY_LINKED_VIEW_LIBRARIES,
} from "@/lib/linked-views/build-libraries";
import {
  getWikiPage,
  getWikiPageAncestors,
  listWikiPagesByHost,
} from "@/lib/wiki-pages/store";

export default async function ProjectWikiPageRoute({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>;
}) {
  const { id, pageId } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.pmProject) notFound();

  const page = await getWikiPage(pageId);
  if (!page || page.project_id !== ctx.pmProject.id) notFound();

  const [ancestors, childPages, bundle] = await Promise.all([
    getWikiPageAncestors(page.id),
    listWikiPagesByHost({
      projectId: ctx.pmProject.id,
      hostKind: page.host_kind,
      hostKey: page.host_key,
      parentId: page.id,
    }),
    loadModuleHomeBundle(ctx),
  ]);
  const libraries = bundle
    ? buildLinkedViewLibraryRows({
        routeId: ctx.routeId,
        learnings: bundle.learnings,
        bugs: bundle.bugs,
        competitors: bundle.competitors,
        prds: bundle.prds,
        requirements: bundle.requirements,
        modules: bundle.modules,
      })
    : EMPTY_LINKED_VIEW_LIBRARIES;

  const session = await getAdminSession();
  const canEdit = session?.role === "admin";
  const projectSlug = ctx.pmSlug ?? ctx.pmProject.slug;

  return (
    <div className="space-y-3">
      <BackLink
        fallback={
          page.host_kind === "module"
            ? `/projects/${projectSlug}/modules`
            : `/projects/${projectSlug}/overview`
        }
        label="← 返回"
        className="inline-block text-sm text-indigo-600 hover:underline"
      />
      <WikiPageView
        projectId={ctx.pmProject.id}
        projectSlug={projectSlug}
        page={page}
        ancestors={ancestors}
        childPages={childPages}
        canEdit={canEdit}
        libraries={libraries}
      />
    </div>
  );
}
