import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { GanttView } from "@/components/gantt-view";
import { HoursView } from "@/components/hours-view";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { readDb } from "@/lib/db/local-store";

export default async function ProjectSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  const pmSlug = ctx.pmSlug;
  if (!pmSlug) {
    if (!ctx.studio) notFound();
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        该项目尚未关联 Star PM 看板，暂无甘特图与工时数据。
      </p>
    );
  }

  const bundle = await fetchProjectBoard(pmSlug);
  if (!bundle) notFound();

  const db = await readDb();
  const iterIds = new Set(bundle.iterations.map((i) => i.id));
  const modules = db.modules.filter((m) => iterIds.has(m.iteration_id));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">甘特图</h2>
        <GanttView
          requirements={bundle.requirements}
          tasks={bundle.role_tasks}
          modules={modules}
        />
      </section>
      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">工时统计</h2>
        <HoursView
          requirements={bundle.requirements}
          tasks={bundle.role_tasks}
          modules={modules}
        />
      </section>
    </div>
  );
}
