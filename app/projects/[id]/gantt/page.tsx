import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { GanttView } from "@/components/gantt-view";
import { AppShell, ProjectNav } from "@/components/ui";

export default async function GanttPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await fetchProjectBoard(id);
  if (!bundle) notFound();

  return (
    <AppShell
      title={`${bundle.project.name} · 甘特图`}
      subtitle="按角色任务起止时间自动生成，模块级排期不虚构子需求时间"
      nav={<ProjectNav projectId={bundle.project.id} slug={bundle.project.slug} />}
    >
      <GanttView
        requirements={bundle.requirements}
        tasks={bundle.role_tasks}
        modules={await (async () => {
          const { readDb } = await import("@/lib/db/local-store");
          const db = await readDb();
          const iterIds = new Set(bundle.iterations.map((i) => i.id));
          return db.modules.filter((m) => iterIds.has(m.iteration_id));
        })()}
      />
    </AppShell>
  );
}
