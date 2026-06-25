import { getProjects } from "@/lib/db";
import { ProjectNav } from "@/components/project-nav";

export async function ProjectNavLoader({
  projectId,
  slug,
}: {
  projectId: string;
  slug: string;
}) {
  const projects = await getProjects();
  return <ProjectNav projectId={projectId} slug={slug} projects={projects} />;
}
