import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-button";
import { WikiPageView } from "@/components/wiki-page-view";
import { getAdminSession } from "@/lib/auth/session";
import { resolveProjectRoute } from "@/lib/project-bridge";
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

  const [ancestors, childPages] = await Promise.all([
    getWikiPageAncestors(page.id),
    listWikiPagesByHost({
      projectId: ctx.pmProject.id,
      hostKind: page.host_kind,
      hostKey: page.host_key,
      parentId: page.id,
    }),
  ]);

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
      />
    </div>
  );
}
