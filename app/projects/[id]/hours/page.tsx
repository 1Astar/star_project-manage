import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { HoursView } from "@/components/hours-view";
import { AppShell, ProjectNav } from "@/components/ui";
import { readDb } from "@/lib/db";

export default async function HoursPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await fetchProjectBoard(id);
  if (!bundle) notFound();

  const db = await readDb();
  const iterIds = new Set(bundle.iterations.map((i) => i.id));
  const modules = db.modules.filter((m) => iterIds.has(m.iteration_id));

  return (
    <AppShell
      title={`${bundle.project.name} · 工时统计`}
      subtitle="模块级与需求级工时不重复累计"
      nav={<ProjectNav projectId={bundle.project.id} slug={bundle.project.slug} />}
    >
      <HoursView
        requirements={bundle.requirements}
        tasks={bundle.role_tasks}
        modules={modules}
      />
    </AppShell>
  );
}
