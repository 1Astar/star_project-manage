"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StructuredCapturePanel } from "@/components/studio/structured-capture-panel";
import type {
  EmotionLevel,
  Idea,
  IdeaStatus,
  IdeaType,
} from "@/lib/studio/types";
import { EMOTION_LABELS, IDEA_STATUS_LABELS, IDEA_TYPE_LABELS } from "@/lib/studio/types";

type ProjectIdeasSectionProps = {
  projectId: string;
  projectTitle: string;
  ideas: Idea[];
};

const TYPE_OPTIONS = Object.keys(IDEA_TYPE_LABELS) as IdeaType[];
const STATUS_OPTIONS = Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[];
const EMOTION_OPTIONS = Object.keys(EMOTION_LABELS) as EmotionLevel[];

const cellInput =
  "w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-1 text-sm outline-none hover:border-slate-200 focus:border-indigo-300 focus:bg-white";

export function ProjectIdeasSection({ projectId, projectTitle, ideas: initialIdeas }: ProjectIdeasSectionProps) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setIdeas(initialIdeas);
  }, [initialIdeas]);

  async function patchIdea(ideaId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/studio/ideas/${ideaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "更新失败");
    setIdeas((prev) => prev.map((i) => (i.id === ideaId ? data.idea : i)));
  }

  async function handleFieldBlur(
    ideaId: string,
    field: "title" | "oneLineIdea",
    raw: string
  ) {
    const existing = ideas.find((i) => i.id === ideaId);
    if (!existing) return;
    const value = raw.trim();
    if (field === "title" && !value) {
      setMessage("标题不能为空");
      return;
    }
    if (existing[field] === value) return;
    try {
      setMessage(null);
      await patchIdea(ideaId, { [field]: value });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function handleSelectChange(
    ideaId: string,
    field: "type" | "status" | "emotionLevel",
    value: string
  ) {
    const existing = ideas.find((i) => i.id === ideaId);
    if (!existing || existing[field] === value) return;
    try {
      setMessage(null);
      await patchIdea(ideaId, { [field]: value });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失败");
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">关联灵感</h2>
          <p className="text-xs text-slate-500">
            {projectTitle} · {ideas.length} 条 · 点格子即可改，失焦保存
          </p>
        </div>
        <Link href={`/stream?project=${projectId}`} className="text-xs text-indigo-600 hover:underline">
          在收件箱查看 →
        </Link>
      </div>

      <StructuredCapturePanel
        projects={[{ id: projectId, label: projectTitle }]}
        defaultProjectId={projectId}
      />

      {message ? <p className="mt-2 text-xs text-slate-600">{message}</p> : null}

      {ideas.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">暂无关联灵感，上方可记一条。</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="min-w-[140px] px-3 py-2.5 font-medium">标题</th>
                <th className="min-w-[200px] px-3 py-2.5 font-medium">一句话</th>
                <th className="px-3 py-2.5 font-medium">类型</th>
                <th className="px-3 py-2.5 font-medium">状态</th>
                <th className="px-3 py-2.5 font-medium">情绪</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ideas.map((idea) => (
                <tr key={idea.id} className="hover:bg-slate-50/80">
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="text"
                      defaultValue={idea.title}
                      onBlur={(e) => handleFieldBlur(idea.id, "title", e.target.value)}
                      className={`${cellInput} font-medium text-slate-800`}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="text"
                      defaultValue={idea.oneLineIdea}
                      onBlur={(e) => handleFieldBlur(idea.id, "oneLineIdea", e.target.value)}
                      placeholder="—"
                      className={`${cellInput} text-slate-600`}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <select
                      value={idea.type}
                      onChange={(e) => handleSelectChange(idea.id, "type", e.target.value)}
                      className={`${cellInput} text-xs`}
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {IDEA_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <select
                      value={idea.status}
                      onChange={(e) => handleSelectChange(idea.id, "status", e.target.value)}
                      className={`${cellInput} text-xs`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {IDEA_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <select
                      value={idea.emotionLevel}
                      onChange={(e) => handleSelectChange(idea.id, "emotionLevel", e.target.value)}
                      className={`${cellInput} text-xs`}
                    >
                      {EMOTION_OPTIONS.map((level) => (
                        <option key={level} value={level}>
                          {EMOTION_LABELS[level]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
