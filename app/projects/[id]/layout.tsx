import { notFound } from "next/navigation";
import { WorkbenchShell } from "@/components/workbench-shell";
import { ProjectNav, ProjectMoreMenu } from "@/components/project-nav";
import { getAdminSession } from "@/lib/auth/session";
import { resolveProjectRoute } from "@/lib/project-bridge";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 布局只需标题/导航：禁止默认拉整板（Egress）
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmProject && !ctx.pmSlug) notFound();

  const session = await getAdminSession();
  const isAdmin = session?.role === "admin";
  const title = ctx.studio?.title ?? ctx.pmProject?.name ?? ctx.pmSlug ?? id;
  const subtitle =
    ctx.studio?.positioning ?? ctx.pmProject?.description ?? undefined;

  return (
    <WorkbenchShell
      title={title}
      subtitle={subtitle}
      role={session?.role ?? "guest"}
      actions={
        <ProjectMoreMenu
          routeId={ctx.routeId}
          pmSlug={ctx.pmSlug}
          showSecrets={isAdmin}
        />
      }
      nav={<ProjectNav routeId={ctx.routeId} />}
    >
      {children}
    </WorkbenchShell>
  );
}
