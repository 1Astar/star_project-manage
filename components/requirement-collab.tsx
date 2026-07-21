"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCommentAction,
  saveAcceptanceAction,
  submitTestAction,
} from "@/lib/actions";
import type { AcceptanceItem, RequirementComment } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

export function RequirementCollabPanel({
  projectId,
  requirementId,
  acceptanceItems,
  comments,
  actorName,
  actorRole,
  shareToken,
  canSubmitTest = true,
  canEditAcceptance = true,
}: {
  projectId: string;
  requirementId: string;
  acceptanceItems: AcceptanceItem[];
  comments: RequirementComment[];
  actorName: string;
  actorRole?: string;
  shareToken?: string;
  canSubmitTest?: boolean;
  canEditAcceptance?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [commentBody, setCommentBody] = useState("");

  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [comments]
  );

  function reviewItem(itemId: string, passed: boolean, note?: string) {
    startTransition(async () => {
      await saveAcceptanceAction({
        itemId,
        passed,
        note,
        actorName,
        actorRole,
        projectId,
        requirementId,
        shareToken,
      });
      router.refresh();
    });
  }

  function submitTest(passed: boolean) {
    const issueDescription = passed
      ? undefined
      : prompt("请填写不通过原因") ?? "测试不通过";
    startTransition(async () => {
      await submitTestAction({
        requirementId,
        passed,
        issueDescription,
        testerName: actorName,
        projectId,
        shareToken,
      });
      router.refresh();
    });
  }

  function submitComment() {
    const body = commentBody.trim();
    if (!body) return;
    startTransition(async () => {
      await addCommentAction({
        projectId,
        requirementId,
        body,
        authorName: actorName,
        authorRole: actorRole,
        shareToken,
      });
      setCommentBody("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {canSubmitTest ? (
        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-2 text-xs font-semibold text-slate-500">测试核对</h2>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => submitTest(true)}
              className="flex-1 rounded-lg bg-green-600 px-2 py-1.5 text-sm font-medium text-white"
            >
              通过
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => submitTest(false)}
              className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-sm font-medium text-white"
            >
              不通过
            </button>
          </div>
        </section>
      ) : null}

      {canEditAcceptance ? (
        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <h2 className="mb-2 text-xs font-semibold text-slate-500">验收项核对</h2>
          {acceptanceItems.length === 0 ? (
            <p className="text-xs text-slate-500">暂无验收项</p>
          ) : (
            <div className="space-y-2">
              {acceptanceItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                  <div className="text-xs font-medium text-slate-800">{item.description}</div>
                  {item.note ? (
                    <div className="mt-0.5 text-xs text-red-600">{item.note}</div>
                  ) : null}
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => reviewItem(item.id, true)}
                      className={`rounded px-2 py-0.5 text-[11px] ${
                        item.passed === true
                          ? "bg-green-100 text-green-700"
                          : "border border-slate-200 bg-white"
                      }`}
                    >
                      验收通过
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        const note = prompt("退回原因") ?? "验收不通过";
                        reviewItem(item.id, false, note);
                      }}
                      className={`rounded px-2 py-0.5 text-[11px] ${
                        item.passed === false
                          ? "bg-red-100 text-red-700"
                          : "border border-slate-200 bg-white"
                      }`}
                    >
                      退回开发
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <h2 className="mb-2 text-xs font-semibold text-slate-500">讨论</h2>
        <div className="mb-2 max-h-40 space-y-1.5 overflow-y-auto">
          {sortedComments.length === 0 ? (
            <p className="text-xs text-slate-500">暂无评论</p>
          ) : (
            sortedComments.map((c) => (
              <div key={c.id} className="rounded-md bg-slate-50 px-2 py-1.5 text-xs">
                <div className="font-medium text-slate-800">
                  {c.author_name}
                  {c.author_role ? (
                    <span className="ml-1 font-normal text-slate-500">
                      {ROLE_LABELS[c.author_role as keyof typeof ROLE_LABELS] ?? c.author_role}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{c.body}</p>
              </div>
            ))
          )}
        </div>
        <textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder="写下评论…"
          rows={2}
          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
        />
        <button
          type="button"
          disabled={pending || !commentBody.trim()}
          onClick={submitComment}
          className="mt-1.5 w-full rounded-lg bg-slate-900 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          发表评论
        </button>
      </section>
    </div>
  );
}
