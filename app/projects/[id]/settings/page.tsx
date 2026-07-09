import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { ProjectGitSettings } from "@/components/project-git-settings";
import { SettingsClient } from "@/components/settings-client";
import { resolveProjectRoute } from "@/lib/project-bridge";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  const slug = ctx.pmSlug ?? id;
  const bundle = await fetchProjectBoard(slug);
  if (!bundle) notFound();

  return (
    <>
      <SettingsClient
        projectId={bundle.project.id}
        projectSlug={bundle.project.slug}
        shareLinks={bundle.share_links}
      />
      <div className="mt-8">
        <ProjectGitSettings project={bundle.project} />
      </div>
    </>
  );
}
