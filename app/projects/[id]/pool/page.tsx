import { redirect } from "next/navigation";
import { resolveProjectRoute } from "@/lib/project-bridge";

/** 需求池已并入「需求与任务」主视图，旧 /pool 链接重定向过去 */
export default async function PoolPageRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  redirect(`/projects/${ctx.routeId}/tasks`);
}
