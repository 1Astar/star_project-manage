import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { resolveProjectRoute } from "@/lib/project-bridge";

/** 项目密钥已并入资源中心「密钥」分类 */
export default async function ProjectSecretsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAdminSession();
  if (session?.role !== "admin") {
    redirect("/?error=keys-forbidden");
  }

  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmProject && !ctx.pmSlug) notFound();

  redirect(`/projects/${ctx.routeId}/resources?cat=secrets`);
}
