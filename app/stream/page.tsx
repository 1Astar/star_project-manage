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
import { StreamActiveFilters } from "@/components/studio/stream-active-filters";
import { StreamQuickCapture } from "@/components/studio/stream-quick-capture";
import { InboxSyncButton } from "@/components/studio/inbox-sync-button";
import { getAllIdeas, getAllProjects, getProjectTitle } from "@/lib/studio/data";
import { getIdeaDateGroup, isIdeaOnDate } from "@/lib/studio/idea-stream-utils";
import type { Idea, IdeaStatus } from "@/lib/studio/types";

function parseView(view?: string): StreamView {
  return view === "table" ? "table" : "timeline";
}

type StreamKind = "star" | "planet" | "meteor";

function parseKind(kind?: string): StreamKind | null {
  if (kind === "star" || kind === "planet" || kind === "meteor") return kind;
  return null;
}

function matchesKind(status: IdeaStatus, kind: StreamKind): boolean {
  if (kind === "planet") return status === "converted" || status === "done";
  if (kind === "meteor") return status === "archived";
  return status !== "converted" && status !== "done" && status !== "archived";
}

function applyStreamFilters(
  ideas: Idea[],
  opts: {
    projectFilter?: string;
    date?: string;
    kind: StreamKind | null;
    includePooled: boolean;
    pooledIdeaIds: Set<string>;
  }
): Idea[] {
  let filtered = ideas;

  if (opts.projectFilter === INBOX_UNLINKED_FILTER) {
    filtered = filtered.filter((idea) => !idea.relatedProjectId);
  } else if (opts.projectFilter) {
    filtered = filtered.filter((idea) => idea.relatedProjectId === opts.projectFilter);
  }

  if (opts.date === "today") {
    filtered = filtered.filter((idea) => isIdeaOnDate(idea.createdAt, "today"));
  } else if (opts.date === "yesterday") {
    filtered = filtered.filter((idea) => getIdeaDateGroup(idea.createdAt) === "yesterday");
  } else if (opts.date) {
    filtered = filtered.filter((idea) => isIdeaOnDate(idea.createdAt, opts.date!));
  }

  if (opts.kind) {
    filtered = filtered.filter((idea) => matchesKind(idea.status, opts.kind!));
  }

  // 默认隐藏已入池 / converted / done；打开「含已入池」或选「已落地星球」时保留
  if (!opts.includePooled && opts.kind !== "planet") {
    filtered = filtered.filter(
      (idea) =>
        !opts.pooledIdeaIds.has(idea.id) &&
        idea.status !== "converted" &&
        idea.status !== "done"
    );
  }

  return filtered;
}

export default async function StreamPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    project?: string;
    date?: string;
    kind?: string;
    idea?: string;
    pooled?: string;
  }>;
}) {
  const {
    view: viewParam,
    project: projectFilter,
    date: dateFilter,
    kind: kindParam,
    idea: focusIdeaId,
    pooled: pooledParam,
  } = await searchParams;
  const currentView = parseView(viewParam);
  const kindFilter = parseKind(kindParam);
  const includePooled = pooledParam === "1";

  const { listPooledStudioIdeaIds } = await import("@/lib/db/local-store");
  const [ideas, projects, pooledIdeaIds] = await Promise.all([
    getAllIdeas(),
    getAllProjects(),
    listPooledStudioIdeaIds(),
  ]);

  const filteredIdeas = applyStreamFilters(ideas, {
    projectFilter,
    date: dateFilter,
    kind: kindFilter,
    includePooled,
    pooledIdeaIds,
  });

  const sortedIdeas = [...filteredIdeas].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const ideasWithMeta = await Promise.all(
    sortedIdeas.map(async (idea) => ({
      idea,
      projectName: idea.relatedProjectId
        ? await getProjectTitle(idea.relatedProjectId)
        : null,
      parentIdeaTitle: idea.relatedIdeaId
        ? sortedIdeas.find((item) => item.id === idea.relatedIdeaId)?.title ??
          ideas.find((item) => item.id === idea.relatedIdeaId)?.title ??
          "未知灵感"
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

  const focusIdeaTitle = focusIdeaId
    ? ideas.find((i) => i.id === focusIdeaId)?.title ?? null
    : null;

  const hasActiveFilter = Boolean(
    dateFilter || kindFilter || focusIdeaId || includePooled
  );
  const emptyMessage = hasActiveFilter || projectFilter ? "没有符合筛选条件的灵感" : "暂无灵感";

  return (
    <WorkbenchShell
      title="灵感流"
      subtitle="脑暴洪水 · 表格可调列宽与筛选 · 时间线速记"
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
          <StreamActiveFilters
            date={dateFilter}
            kind={kindFilter}
            ideaTitle={focusIdeaTitle}
            includePooled={includePooled}
          />
        </Suspense>

        <Suspense fallback={null}>
          <StreamProjectTags
            projects={tagOptions}
            currentProject={projectFilter ?? null}
            includePooled={includePooled}
          />
        </Suspense>

        {currentView === "timeline" ? (
          <IdeaStreamTimeline items={ideasWithMeta} focusIdeaId={focusIdeaId} />
        ) : (
          <InboxTableView rows={ideasWithMeta} emptyMessage={emptyMessage} />
        )}
      </div>

      <StreamQuickCapture projects={projectOptions} defaultProjectId={defaultProjectId} />
    </WorkbenchShell>
  );
}
