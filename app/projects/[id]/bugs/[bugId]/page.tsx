import { notFound } from "next/navigation";
import { fetchBugDetail } from "@/lib/actions";
import { BugDetailEditor } from "@/components/bug-side-form";
import { resolveProjectRoute } from "@/lib/project-bridge";
import {
  getProjectMembers,
  listProjectIterations,
  listProjectRequirementOptions,
} from "@/lib/db/local-store";
import { listBugTestPlans } from "@/lib/bugs/test-plans";
import { resolveFeatureModules } from "@/lib/studio/project-modules";

export default async function BugDetailPage({
  params,
}: {
  params: Promise<{ id: string; bugId: string }>;
}) {
  const { id, bugId } = await params;
  const ctx = await resolveProjectRoute(id);
  const detail = await fetchBugDetail(bugId);
  if (!detail?.bug || !detail.project) notFound();

  const [members, requirements, testPlans, iterations] = await Promise.all([
    getProjectMembers(detail.project.id),
    listProjectRequirementOptions(detail.project.id),
    listBugTestPlans(detail.project.id, { includeArchived: true }),
    listProjectIterations(detail.project.id),
  ]);
  const featureModules = resolveFeatureModules(
    ctx.studio?.id ?? detail.project.id,
    ctx.studio?.featureModules,
    ctx.studio?.githubRepo
  );

  return (
    <BugDetailEditor
      bug={detail.bug}
      projectId={detail.project.id}
      projectSlug={ctx.routeId}
      projectName={detail.project.name}
      requirementTitle={detail.requirement?.title ?? null}
      members={members.map((m) => ({ name: m.name }))}
      requirements={requirements}
      featureModules={featureModules}
      testPlans={testPlans}
      iterations={iterations}
      comments={detail.comments ?? []}
      attachments={detail.attachments ?? []}
    />
  );
}
