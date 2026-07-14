import { redirect } from "next/navigation";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; view?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.view) qs.set("view", params.view);
  if (params.project) qs.set("project", params.project);
  const suffix = qs.toString();
  redirect(suffix ? `/stream?${suffix}` : "/stream");
}
