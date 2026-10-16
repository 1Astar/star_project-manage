import { notFound } from "next/navigation";
import { PrdWorkspaceClient } from "@/components/prd-workspace-client";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { ensureProjectHasPrd, listPrdComments } from "@/lib/prds/store";
import { resolveFeatureModules } from "@/lib/studio/project-modules";
import { readDb } from "@/lib/db/local-store";

export default async function ProjectPrdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmProject && !ctx.pmSlug) notFound();

  const projectId = ctx.pmProject?.id ?? ctx.studio?.id;
  if (!projectId) notFound();

  const projectTitle = ctx.studio?.title ?? ctx.pmProject?.name ?? ctx.routeId;
  const [{ prds }, db] = await Promise.all([
    ensureProjectHasPrd({
      project_id: projectId,
      title: `${projectTitle} PRD`,
    }),
    readDb(),
  ]);
  const prototypes = (db.prototypes ?? []).filter(
    (p) =>
      p.project_id === projectId ||
      p.project_id === ctx.pmProject?.id ||
      p.project_id === ctx.studio?.id
  );
  const commentsByPrd: Record<
    string,
    Awaited<ReturnType<typeof listPrdComments>>
  > = {};
  await Promise.all(
    prds.map(async (prd) => {
      commentsByPrd[prd.id] = await listPrdComments(prd.id);
    })
  );

  const featureModules = resolveFeatureModules(
    ctx.studio?.id ?? projectId,
    ctx.studio?.featureModules,
    ctx.studio?.githubRepo
  );

  return (
    <PrdWorkspaceClient
      projectId={projectId}
      projectSlug={ctx.routeId}
      projectTitle={projectTitle}
      studioProjectId={ctx.studio?.id ?? null}
      featureModules={featureModules}
      initialPrds={prds}
      prototypes={prototypes}
      initialCommentsByPrd={commentsByPrd}
    />
  );
}
