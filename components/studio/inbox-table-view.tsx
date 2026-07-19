"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StudioBadge } from "@/components/studio/shell";
import { ConvertIdeaButton } from "@/components/studio/convert-idea-button";
import { formatIdeaDateTime, ideaOccurredAt } from "@/lib/studio/idea-stream-utils";
import {
  IDEA_TYPE_LABELS,
  IDEA_STATUS_LABELS,
  type Idea,
} from "@/lib/studio/types";

export type InboxTableRow = {
  idea: Idea;
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
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleIds = useMemo(() => rows.map((r) => r.idea.id), [rows]);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  }

  async function bulkArchive() {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`将选中的 ${ids.length} 条灵感归档？不会从数据库硬删除。`)) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/ideas/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "归档失败");
        return;
      }
      setSelected(new Set());
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
          <span className="text-xs text-slate-600">已选 {selected.size} 条</span>
          <button
            type="button"
            disabled={pending}
            onClick={bulkArchive}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {pending ? "归档中…" : "批量归档"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setSelected(new Set())}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            取消选择
          </button>
          {error ? <span className="text-xs text-red-600">{error}</span> : null}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={rows.length === 0}
                  title="全选当前列表"
                  aria-label="全选"
                />
              </th>
              <th className="sticky left-0 z-10 min-w-[160px] bg-slate-50 px-4 py-3 font-medium">
                标题
              </th>
              <th className="min-w-[200px] px-4 py-3 font-medium">一句话想法</th>
              <th className="min-w-[72px] px-4 py-3 font-medium">类型</th>
              <th className="min-w-[72px] px-4 py-3 font-medium">优先级</th>
              <th className="min-w-[80px] px-4 py-3 font-medium">状态</th>
              <th className="min-w-[120px] px-4 py-3 font-medium">发生时间</th>
              <th className="min-w-[120px] px-4 py-3 font-medium">完成时间</th>
              <th className="min-w-[120px] px-4 py-3 font-medium">关联</th>
              <th className="min-w-[100px] px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map(({ idea, projectName, parentIdeaTitle }) => (
                <tr key={idea.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(idea.id)}
                      onChange={() => toggleOne(idea.id)}
                      aria-label={`选择 ${idea.title}`}
                    />
                  </td>
                  <td className="sticky left-0 z-[1] bg-white px-4 py-3 font-medium text-slate-800">
                    {idea.title}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">{idea.oneLineIdea}</td>
                  <td className="px-4 py-3">
                    <StudioBadge>{IDEA_TYPE_LABELS[idea.type]}</StudioBadge>
                  </td>
                  <td className="px-4 py-3">
                    <StudioBadge tone={priorityTone(idea.priority)}>{idea.priority}</StudioBadge>
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
                  <td className="px-4 py-3 tabular-nums text-slate-500">
                    {formatIdeaDateTime(ideaOccurredAt(idea))}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">
                    {idea.completedAt ? formatIdeaDateTime(idea.completedAt) : "—"}
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
