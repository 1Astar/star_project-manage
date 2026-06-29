import { headers } from "next/headers";
import { getProjects } from "@/lib/db";
import { ProjectSwitcher } from "@/components/project-switcher";
import { ProjectNavLinks } from "@/components/project-nav-links";

export async function ProjectNavLoader({
  projectId,
  slug,
}: {
  projectId: string;
  slug: string;
}) {
  const projects = await getProjects();
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? `/projects/${slug || projectId}`;
  const base = `/projects/${slug || projectId}`;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <ProjectSwitcher projects={projects} currentSlug={slug} />
      <ProjectNavLinks base={base} pathname={pathname} />
    </div>
  );
}
