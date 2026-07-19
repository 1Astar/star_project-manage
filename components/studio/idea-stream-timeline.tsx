"use client";

import { useEffect } from "react";
import Link from "next/link";
import { StudioBadge } from "@/components/studio/shell";
import { ConvertIdeaButton } from "@/components/studio/convert-idea-button";
import {
  IDEA_TYPE_EMOJI,
  IDEA_DATE_GROUP_LABELS,
  formatIdeaTime,
  formatIdeaDateTime,
  groupIdeasByDate,
  ideaOccurredAt,
  ideaSummaryLine,
  type IdeaDateGroup,
} from "@/lib/studio/idea-stream-utils";
import type { Idea } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

const GROUP_ORDER: IdeaDateGroup[] = ["today", "yesterday", "earlier"];

export type TimelineIdea = {
  idea: Idea;
  projectName: string | null;
};

export function IdeaStreamTimeline({
  items,
  focusIdeaId,
}: {
  items: TimelineIdea[];
  focusIdeaId?: string | null;
}) {
  const ideas = items.map((item) => item.idea);
  const groups = groupIdeasByDate(ideas);
  const projectMap = new Map(items.map((item) => [item.idea.id, item.projectName]));

  useEffect(() => {
    if (!focusIdeaId) return;
    const el = document.getElementById(`idea-${focusIdeaId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusIdeaId]);

  const hasAny = ideas.length > 0;
  if (!hasAny) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
        还没有灵感，在底部输入框随手记一条吧
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {GROUP_ORDER.map((group) => {
        const groupIdeas = groups[group];
        if (groupIdeas.length === 0) return null;

        return (
          <section key={group}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {IDEA_DATE_GROUP_LABELS[group]}
            </h2>
            <ul className="space-y-2">
              {groupIdeas.map((idea) => {
                const focused = focusIdeaId === idea.id;
                return (
                  <li
                    key={idea.id}
                    id={`idea-${idea.id}`}
                    className={cn(
                      "flex gap-3 rounded-xl border bg-white px-4 py-3 transition hover:border-indigo-100 hover:shadow-sm",
                      focused
                        ? "border-indigo-400 ring-2 ring-indigo-100"
                        : "border-slate-200"
                    )}
                  >
                    <span
                      className="shrink-0 pt-0.5 text-xs tabular-nums text-slate-400"
                      title="灵感发生时间"
                    >
                      {formatIdeaTime(ideaOccurredAt(idea))}
                    </span>
                    <span className="shrink-0 text-base" title={idea.type}>
                      {IDEA_TYPE_EMOJI[idea.type]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-800">{idea.title}</span>
                        <StudioBadge
                          tone={
                            idea.priority === "P0" ? "p0" : idea.priority === "P1" ? "p1" : "default"
                          }
                        >
                          {idea.priority}
                        </StudioBadge>
                        {projectMap.get(idea.id) ? (
                          idea.relatedProjectId ? (
                            <Link
                              href={`/projects/${idea.relatedProjectId}`}
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              {projectMap.get(idea.id)}
                            </Link>
                          ) : null
                        ) : (
                          <span className="text-xs text-slate-400">未归属</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{ideaSummaryLine(idea)}</p>
                      {idea.completedAt ? (
                        <p className="mt-1 text-xs text-emerald-600">
                          完成于 {formatIdeaDateTime(idea.completedAt)}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 self-center">
                      <ConvertIdeaButton
                        ideaId={idea.id}
                        ideaTitle={idea.title}
                        status={idea.status}
                        relatedProjectId={idea.relatedProjectId}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
