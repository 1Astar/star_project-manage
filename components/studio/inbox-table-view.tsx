"use client";

import Link from "next/link";
import { StudioBadge } from "@/components/studio/shell";
import { ConvertIdeaButton } from "@/components/studio/convert-idea-button";
import {
  IDEA_TYPE_LABELS,
  EMOTION_LABELS,
  IDEA_STATUS_LABELS,
} from "@/lib/studio/types";

export type InboxTableRow = {
  idea: {
    id: string;
    title: string;
    oneLineIdea: string;
    type: keyof typeof IDEA_TYPE_LABELS;
    priority: string;
    emotionLevel: keyof typeof EMOTION_LABELS;
    status: keyof typeof IDEA_STATUS_LABELS;
    triggerSource: string;
    githubIssueUrl: string | null;
    githubIssueNumber: number | null;
    relatedProjectId: string | null;
    relatedIdeaId: string | null;
    createdAt: string;
  };
  projectName: string | null;
  parentIdeaTitle: string | null;
};

function priorityTone(priority: string) {
  if (priority === "P0") return "p0" as const;
  if (priority === "P1") return "p1" as const;
  return "default" as const;
}

export function InboxTableView({
  rows,
  emptyMessage = "暂无灵感",
}: {
  rows: InboxTableRow[];
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">标题</th>
            <th className="px-4 py-3 font-medium">一句话想法</th>
            <th className="px-4 py-3 font-medium">类型</th>
            <th className="px-4 py-3 font-medium">优先级</th>
            <th className="px-4 py-3 font-medium">情绪</th>
            <th className="px-4 py-3 font-medium">状态</th>
            <th className="px-4 py-3 font-medium">来源</th>
            <th className="px-4 py-3 font-medium">Issue</th>
            <th className="px-4 py-3 font-medium">关联</th>
            <th className="px-4 py-3 font-medium">操作</th>
            <th className="px-4 py-3 font-medium">创建时间</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-8 text-center text-sm text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map(({ idea, projectName, parentIdeaTitle }) => (
              <tr key={idea.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{idea.title}</td>
                <td className="max-w-xs px-4 py-3 text-slate-600">{idea.oneLineIdea}</td>
                <td className="px-4 py-3">
                  <StudioBadge>{IDEA_TYPE_LABELS[idea.type]}</StudioBadge>
                </td>
                <td className="px-4 py-3">
                  <StudioBadge tone={priorityTone(idea.priority)}>{idea.priority}</StudioBadge>
                </td>
                <td className="px-4 py-3">
                  <StudioBadge tone={idea.emotionLevel === "excited" ? "warning" : "default"}>
                    {EMOTION_LABELS[idea.emotionLevel]}
                  </StudioBadge>
                </td>
                <td className="px-4 py-3">
                  <StudioBadge
                    tone={
                      idea.status === "converted" || idea.status === "done" ? "success" : "muted"
                    }
                  >
                    {IDEA_STATUS_LABELS[idea.status]}
                  </StudioBadge>
                </td>
                <td className="px-4 py-3 text-slate-500">{idea.triggerSource || "—"}</td>
                <td className="px-4 py-3">
                  {idea.githubIssueUrl ? (
                    <a
                      href={idea.githubIssueUrl}
                      className="text-indigo-600 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      #{idea.githubIssueNumber}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {idea.relatedProjectId ? (
                    <Link
                      href={`/projects/${idea.relatedProjectId}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {projectName}
                    </Link>
                  ) : idea.relatedIdeaId ? (
                    <span className="text-slate-600">↳ {parentIdeaTitle}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <ConvertIdeaButton
                    ideaId={idea.id}
                    ideaTitle={idea.title}
                    status={idea.status}
                    relatedProjectId={idea.relatedProjectId}
                  />
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {new Date(idea.createdAt).toLocaleDateString("zh-CN")}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
