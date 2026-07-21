import { notFound } from "next/navigation";
import { fetchBugDetail, fetchProjectBoard } from "@/lib/actions";
import { BugDetailEditor } from "@/components/bug-side-form";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { getProjectMembers } from "@/lib/db/local-store";

export default async function BugDetailPage({
  params,
}: {
  params: Promise<{ id: string; bugId: string }>;
}) {
  const { id, bugId } = await params;
  const ctx = await resolveProjectRoute(id);
  const detail = await fetchBugDetail(bugId);
  if (!detail?.bug || !detail.project) notFound();

  const pmBundle =
    ctx.pmBundle ?? (ctx.pmSlug ? await fetchProjectBoard(ctx.pmSlug) : null);
  const members = await getProjectMembers(detail.project.id);
  const requirements = (pmBundle?.requirements ?? []).map((r) => ({
    id: r.id,
    title: r.title,
  }));

  return (
    <BugDetailEditor
      bug={detail.bug}
      projectSlug={ctx.routeId}
      projectName={detail.project.name}
      requirementTitle={detail.requirement?.title ?? null}
      members={members.map((m) => ({ name: m.name }))}
      requirements={requirements}
    />
  );
}
