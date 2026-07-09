import Link from "next/link";
import { StudioShell, StudioBadge } from "@/components/studio/shell";
import { getParkedIdeas, getParkedProjects } from "@/lib/studio/data";
import { IDEA_TYPE_LABELS, PROJECT_STATUS_LABELS } from "@/lib/studio/types";

export default async function ParkingPage() {
  const [parkedIdeas, parkedProjects] = await Promise.all([
    getParkedIdeas(),
    getParkedProjects(),
  ]);

  return (
    <StudioShell
      title="灵感停车场"
      subtitle="被关起来的小怪物们 — 不是删除，是暂时搁置"
    >
      <section>
        <h2 className="text-sm font-semibold text-stone-500">停车的灵感</h2>
        {parkedIdeas.length === 0 ? (
          <p className="mt-3 text-sm text-stone-400">暂无停车灵感</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {parkedIdeas.map((idea) => (
              <li
                key={idea.id}
                className="rounded-lg border border-stone-200 bg-white p-4"
              >
                <div className="font-medium text-stone-800">{idea.title}</div>
                <p className="mt-1 text-sm text-stone-500">{idea.oneLineIdea}</p>
                <div className="mt-2 flex gap-2">
                  <StudioBadge>{IDEA_TYPE_LABELS[idea.type]}</StudioBadge>
                  {idea.relatedProjectId ? (
                    <Link
                      href={`/studio/projects/${idea.relatedProjectId}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      关联项目
                    </Link>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-stone-400">{idea.whyItMatters}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-stone-500">停车的项目</h2>
        {parkedProjects.length === 0 ? (
          <p className="mt-3 text-sm text-stone-400">暂无停车项目</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {parkedProjects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/studio/projects/${p.id}`}
                  className="block rounded-lg border border-stone-200 bg-white p-4 hover:bg-stone-50"
                >
                  <div className="flex items-center gap-2">
                    <StudioBadge tone="muted">{PROJECT_STATUS_LABELS.parking}</StudioBadge>
                    <span className="font-medium text-stone-800">{p.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-stone-500">{p.positioning}</p>
                  <p className="mt-2 text-xs text-stone-400">下一步：{p.nextAction}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </StudioShell>
  );
}
