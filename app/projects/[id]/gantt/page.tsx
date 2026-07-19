import { redirect } from "next/navigation";
import { resolveProjectRoute } from "@/lib/project-bridge";

/** 旧 /gantt 入口 → 需求与任务 · 甘特 */
export default async function GanttRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  redirect(`/projects/${ctx.routeId}/tasks?view=gantt`);
}
