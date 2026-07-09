import { notFound } from "next/navigation";
import { validateShareToken } from "@/lib/actions";
import { ShareRequirementPage } from "@/components/share-requirement-page";
import { getRequirementDetail, getBugById } from "@/lib/db/local-store";
import { AppShell, StatusBadge } from "@/components/ui";

export default async function ShareItemPage({
  params,
}: {
  params: Promise<{ token: string; itemId: string }>;
}) {
  const { token, itemId } = await params;
  const shareData = await validateShareToken(token);
  if (!shareData?.bundle) notFound();

  const requirementDetail = await getRequirementDetail(itemId);
  const bugDetail = itemId.startsWith("bug-") ? await getBugById(itemId) : null;

  if (requirementDetail?.project?.id !== shareData.bundle.project.id && !bugDetail) {
    notFound();
  }

  if (bugDetail?.bug) {
    return (
      <AppShell
        title={`Bug #${bugDetail.bug.id.slice(-6)}`}
        subtitle={bugDetail.project?.name}
      >
        <div className="card space-y-4 p-6">
          <h2 className="text-lg font-bold">{bugDetail.bug.title}</h2>
          <StatusBadge status={bugDetail.bug.status} />
          {bugDetail.bug.description ? (
            <p className="text-sm text-slate-600">{bugDetail.bug.description}</p>
          ) : null}
        </div>
      </AppShell>
    );
  }

  if (!requirementDetail?.requirement) notFound();

  return (
    <ShareRequirementPage
      token={token}
      link={shareData.link}
      requirement={requirementDetail.requirement}
      role_tasks={requirementDetail.role_tasks}
      acceptance_items={requirementDetail.acceptance_items}
      comments={requirementDetail.comments ?? []}
      test_records={requirementDetail.test_records}
    />
  );
}
