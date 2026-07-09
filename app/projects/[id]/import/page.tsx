import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { ImportClient } from "@/components/import-client";
import { resolveProjectRoute } from "@/lib/project-bridge";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  const slug = ctx.pmSlug ?? id;
  const bundle = await fetchProjectBoard(slug);
  if (!bundle) notFound();

  return <ImportClient projectSlug={bundle.project.slug} projectId={bundle.project.id} />;
}
