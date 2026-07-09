import { redirect } from "next/navigation";
import { resolveProjectRoute } from "@/lib/project-bridge";

export default async function HoursRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  redirect(`/projects/${ctx.routeId}/schedule`);
}
