import { notFound } from "next/navigation";
import { fetchBugDetail } from "@/lib/actions";
import { BugDetailEditor } from "@/components/bug-side-form";
import { resolveProjectRoute } from "@/lib/project-bridge";
import {
  getProjectMembers,
  listProjectRequirementOptions,
} from "@/lib/db/local-store";

export default async function BugDetailPage({
  params,
}: {
  params: Promise<{ id: string; bugId: string }>;
}) {
  const { id, bugId } = await params;
  const ctx = await resolveProjectRoute(id);
  const detail = await fetchBugDetail(bugId);
  if (!detail?.bug || !detail.project) notFound();

  const members = await getProjectMembers(detail.project.id);
  const requirements = await listProjectRequirementOptions(detail.project.id);

  return (
    <BugDetailEditor
      bug={detail.bug}
      projectSlug={ctx.routeId}
      projectName={detail.project.name}
      requirementTitle={detail.requirement?.title ?? null}
      members={members.map((m) => ({ name: m.name }))}
      requirements={requirements}
      comments={detail.comments ?? []}
      attachments={detail.attachments ?? []}
    />
  );
}
