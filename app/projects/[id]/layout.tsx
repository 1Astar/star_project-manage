import { notFound } from "next/navigation";
import { WorkbenchShell } from "@/components/workbench-shell";
import { ProjectNav, ProjectMoreMenu } from "@/components/project-nav";
import { resolveProjectRoute } from "@/lib/project-bridge";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmBundle) notFound();

  const title = ctx.studio?.title ?? ctx.pmBundle!.project.name;
  const subtitle = ctx.studio?.positioning ?? ctx.pmBundle!.project.description ?? undefined;

  return (
    <WorkbenchShell
      title={title}
      subtitle={subtitle}
      actions={<ProjectMoreMenu routeId={ctx.routeId} pmSlug={ctx.pmSlug} />}
      nav={<ProjectNav routeId={ctx.routeId} />}
    >
      {children}
    </WorkbenchShell>
  );
}
