"use client";

import { useEffect } from "react";
import Link from "next/link";
import { EntityCard } from "@/components/entity-card";
import { ConvertIdeaButton } from "@/components/studio/convert-idea-button";
import { ConvertIdeaToRequirementButton } from "@/components/studio/convert-idea-to-requirement-button";
import { StudioBadge } from "@/components/studio/shell";
import {
  IDEA_TYPE_EMOJI,
  formatIdeaDateTime,
  ideaOccurredAt,
  ideaSummaryLine,
} from "@/lib/studio/idea-stream-utils";
import type { Idea } from "@/lib/studio/types";

export type CardIdea = {
  idea: Idea;
  projectName: string | null;
};

export function IdeaStreamCards({
  items,
  focusIdeaId,
}: {
  items: CardIdea[];
  focusIdeaId?: string | null;
}) {
  useEffect(() => {
    if (!focusIdeaId) return;
    const el = document.getElementById(`idea-card-${focusIdeaId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusIdeaId]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
        还没有灵感，在底部输入框随手记一条吧
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(({ idea, projectName }) => {
        const focused = focusIdeaId === idea.id;
        return (
          <div
            key={idea.id}
            id={`idea-card-${idea.id}`}
            className={focused ? "rounded-xl ring-2 ring-indigo-200" : undefined}
          >
            <EntityCard
              title={idea.title}
              icon={<span title={idea.type}>{IDEA_TYPE_EMOJI[idea.type]}</span>}
              description={ideaSummaryLine(idea)}
              status={
                <StudioBadge
                  tone={
                    idea.priority === "P0"
                      ? "p0"
                      : idea.priority === "P1"
                        ? "p1"
                        : "default"
                  }
                >
                  {idea.priority}
                </StudioBadge>
              }
              tags={
                <>
                  <StudioBadge tone="muted">{idea.status}</StudioBadge>
                  {idea.relatedModule ? (
                    <StudioBadge tone="muted">{idea.relatedModule}</StudioBadge>
                  ) : null}
                  {projectName && idea.relatedProjectId ? (
                    <Link
                      href={`/projects/${idea.relatedProjectId}`}
                      className="rounded px-2 py-0.5 text-xs font-medium text-indigo-600 hover:underline"
                    >
                      {projectName}
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">未归属项目</span>
                  )}
                  <span className="text-xs text-slate-400">
                    {formatIdeaDateTime(ideaOccurredAt(idea))}
                  </span>
                </>
              }
              actions={
                <>
                  <ConvertIdeaToRequirementButton
                    ideaId={idea.id}
                    ideaTitle={idea.title}
                    relatedProjectId={idea.relatedProjectId}
                    defaultAcceptance={idea.suggestedNextStep}
                    compact
                  />
                  <ConvertIdeaButton
                    ideaId={idea.id}
                    ideaTitle={idea.title}
                    status={idea.status}
                    relatedProjectId={idea.relatedProjectId}
                  />
                </>
              }
              details={
                <div className="space-y-2 whitespace-pre-wrap">
                  {idea.whyItMatters?.trim() ? (
                    <p>
                      <span className="font-medium text-slate-500">为什么 · </span>
                      {idea.whyItMatters}
                    </p>
                  ) : null}
                  {idea.suggestedNextStep?.trim() ? (
                    <p>
                      <span className="font-medium text-slate-500">下一步 · </span>
                      {idea.suggestedNextStep}
                    </p>
                  ) : null}
                  {idea.rawInput?.trim() ? (
                    <p>
                      <span className="font-medium text-slate-500">原文 · </span>
                      {idea.rawInput}
                    </p>
                  ) : null}
                  {!idea.whyItMatters?.trim() &&
                  !idea.suggestedNextStep?.trim() &&
                  !idea.rawInput?.trim() ? (
                    <p className="text-slate-400">暂无更多字段</p>
                  ) : null}
                </div>
              }
            />
          </div>
        );
      })}
    </div>
  );
}
