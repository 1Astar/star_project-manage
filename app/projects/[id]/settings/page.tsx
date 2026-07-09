import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { ProjectGitSettings } from "@/components/project-git-settings";
import { SettingsClient } from "@/components/settings-client";
import { AppShell, ProjectNav } from "@/components/ui";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await fetchProjectBoard(id);
  if (!bundle) notFound();

  return (
    <AppShell
      title={`${bundle.project.name} · 项目设置`}
      subtitle="角色分享链接、原型来源与导入入口"
      nav={<ProjectNav projectId={bundle.project.id} slug={bundle.project.slug} />}
    >
      <SettingsClient
        projectId={bundle.project.id}
        projectSlug={bundle.project.slug}
        shareLinks={bundle.share_links}
      />
      <div className="mt-8">
        <ProjectGitSettings project={bundle.project} />
      </div>
    </AppShell>
  );
}
