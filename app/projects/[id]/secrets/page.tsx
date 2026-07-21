import { notFound, redirect } from "next/navigation";
import { ProjectSecretsPanel } from "@/components/studio/project-secrets-panel";
import { getAdminSession } from "@/lib/auth/session";
import { resolveProjectRoute } from "@/lib/project-bridge";

export default async function ProjectSecretsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAdminSession();
  if (session?.role === "viewer") {
    redirect("/?error=keys-forbidden");
  }

  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio) notFound();

  return <ProjectSecretsPanel projectId={ctx.studio.id} />;
}
