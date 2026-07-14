import { Suspense } from "react";
import { WorkbenchShell } from "@/components/workbench-shell";
import { INBOX_UNLINKED_FILTER } from "@/components/studio/list-filter-bar";
import { IdeaCapturePanel } from "@/components/studio/idea-capture-panel";
import { StructuredCapturePanel } from "@/components/studio/structured-capture-panel";
import { IdeaDigestPanel } from "@/components/studio/idea-digest-panel";
import { IdeaStreamTimeline } from "@/components/studio/idea-stream-timeline";
import { InboxTableView } from "@/components/studio/inbox-table-view";
import {
  IdeaStreamTabs,
  StreamProjectTags,
  type StreamView,
} from "@/components/studio/idea-stream-tabs";
import { StreamQuickCapture } from "@/components/studio/stream-quick-capture";
import { InboxSyncButton } from "@/components/studio/inbox-sync-button";
import { getAllIdeas, getAllProjects, getProjectTitle } from "@/lib/studio/data";

function parseView(view?: string): StreamView {
  return view === "table" ? "table" : "timeline";
}

export default async function StreamPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; project?: string }>;
}) {
  const { view: viewParam, project: projectFilter } = await searchParams;
  const currentView = parseView(viewParam);

  const [ideas, projects] = await Promise.all([getAllIdeas(), getAllProjects()]);

  let filteredIdeas = ideas;
  if (projectFilter === INBOX_UNLINKED_FILTER) {
    filteredIdeas = ideas.filter((idea) => !idea.relatedProjectId);
  } else if (projectFilter) {
    filteredIdeas = ideas.filter((idea) => idea.relatedProjectId === projectFilter);
  }

  const sortedIdeas = [...filteredIdeas].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const ideasWithMeta = await Promise.all(
    sortedIdeas.map(async (idea) => ({
      idea,
      projectName: idea.relatedProjectId
        ? await getProjectTitle(idea.relatedProjectId)
        : null,
      parentIdeaTitle: idea.relatedIdeaId
        ? sortedIdeas.find((item) => item.id === idea.relatedIdeaId)?.title ?? "未知灵感"
        : null,
    }))
  );

  const projectOptions = projects.map((p) => ({ id: p.id, label: p.title }));
  const tagOptions = [
    { id: INBOX_UNLINKED_FILTER, label: "未归属" },
    ...projectOptions,
  ];

  const ideaOptions = sortedIdeas.map((i) => ({ id: i.id, label: i.title }));

  const defaultProjectId =
    projectFilter && projectFilter !== INBOX_UNLINKED_FILTER ? projectFilter : null;

  return (
    <WorkbenchShell
      title="灵感流"
      subtitle="脑暴洪水 · 时间线速记 · AI 批量整理"
      actions={<InboxSyncButton />}
      nav={
        <Suspense fallback={<div className="h-9" />}>
          <IdeaStreamTabs currentView={currentView} />
        </Suspense>
      }
    >
      <div className="space-y-4 pb-24">
        <IdeaDigestPanel
          projects={projectOptions}
          ideas={sortedIdeas.map((i) => ({ id: i.id, title: i.title }))}
        />

        <details className="rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-600">
            AI 深度录入 / 结构化捕获
          </summary>
          <div className="mt-4 space-y-4">
            <StructuredCapturePanel
              projects={projectOptions}
              defaultProjectId={defaultProjectId ?? undefined}
            />
            <IdeaCapturePanel projects={projectOptions} ideas={ideaOptions} />
          </div>
        </details>

        <Suspense fallback={null}>
          <StreamProjectTags projects={tagOptions} currentProject={projectFilter ?? null} />
        </Suspense>

        {currentView === "timeline" ? (
          <IdeaStreamTimeline items={ideasWithMeta} />
        ) : (
          <InboxTableView
            rows={ideasWithMeta}
            emptyMessage={projectFilter ? "没有符合筛选条件的灵感" : "暂无灵感"}
          />
        )}
      </div>

      <StreamQuickCapture projects={projectOptions} defaultProjectId={defaultProjectId} />
    </WorkbenchShell>
  );
}
