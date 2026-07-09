import Link from "next/link";
import { StudioShell, StudioBadge, RecoveryCard } from "@/components/studio/shell";
import { getMainlineProject, getProjectTasks } from "@/lib/studio/data";
import { TASK_STATUS_LABELS } from "@/lib/studio/types";

export default async function MainlinePage() {
  const mainline = await getMainlineProject();
  if (!mainline) {
    return (
      <StudioShell title="当前主线" subtitle="暂无主线项目">
        <p className="text-stone-500">请在项目库中将某个项目设为主线。</p>
      </StudioShell>
    );
  }

  const tasks = await getProjectTasks(mainline.id);

  return (
    <StudioShell title="当前主线" subtitle={mainline.title}>
      <RecoveryCard project={mainline} />

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-stone-500">主线任务</h2>
        <ul className="mt-3 space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-md border border-stone-100 bg-white px-4 py-3"
            >
              <div>
                <span className="font-medium text-stone-800">{t.title}</span>
                {t.blocker ? (
                  <span className="ml-2 text-xs text-orange-600">阻塞：{t.blocker}</span>
                ) : null}
              </div>
              <div className="flex gap-2">
                <StudioBadge tone={t.priority === "P0" ? "p0" : "p1"}>{t.priority}</StudioBadge>
                <StudioBadge>{TASK_STATUS_LABELS[t.status]}</StudioBadge>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6">
        <Link
          href={`/studio/projects/${mainline.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          打开完整项目页 →
        </Link>
      </div>
    </StudioShell>
  );
}
