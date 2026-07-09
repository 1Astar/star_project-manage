"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addCommentAction } from "@/lib/actions";
import type { Requirement, RequirementComment } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

export function ProjectCommentFeed({
  token,
  projectId,
  requirements,
  comments,
  actorName,
  actorRole,
}: {
  token: string;
  projectId: string;
  requirements: Requirement[];
  comments: RequirementComment[];
  actorName: string;
  actorRole?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requirementId, setRequirementId] = useState(requirements[0]?.id ?? "");
  const [body, setBody] = useState("");

  const reqTitleById = useMemo(
    () => new Map(requirements.map((r) => [r.id, r.title])),
    [requirements]
  );

  const sorted = useMemo(
    () => [...comments].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [comments]
  );

  function submit() {
    const text = body.trim();
    if (!text || !requirementId) return;
    startTransition(async () => {
      await addCommentAction({
        projectId,
        requirementId,
        body: text,
        authorName: actorName,
        authorRole: actorRole,
        shareToken: token,
      });
      setBody("");
      router.refresh();
    });
  }

  return (
    <section className="card mt-8 p-5 space-y-4">
      <h2 className="font-semibold">项目讨论</h2>
      <p className="text-sm text-slate-500">本项目成员均可评论，评论会挂在对应需求下。</p>

      <div className="flex flex-wrap gap-2">
        <select
          value={requirementId}
          onChange={(e) => setRequirementId(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {requirements.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="写评论…"
          className="min-w-[200px] flex-[2] rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={pending || !body.trim()}
          onClick={submit}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          发送
        </button>
      </div>

      <div className="space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500">暂无讨论</p>
        ) : (
          sorted.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.author_name}</span>
                {c.author_role ? (
                  <span className="text-slate-500">
                    {ROLE_LABELS[c.author_role as keyof typeof ROLE_LABELS] ?? c.author_role}
                  </span>
                ) : null}
                <Link
                  href={`/share/${token}/items/${c.requirement_id}`}
                  className="text-blue-600 hover:underline"
                >
                  {reqTitleById.get(c.requirement_id) ?? "需求"}
                </Link>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{c.body}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
