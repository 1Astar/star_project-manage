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
    <div className="space-y-6">
      {canSubmitTest ? (
        <section className="card p-5 space-y-3">
          <h2 className="font-semibold">测试核对</h2>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => submitTest(true)}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              通过
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => submitTest(false)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              不通过
            </button>
          </div>
        </section>
      ) : null}

      {canEditAcceptance ? (
        <section className="card p-5 space-y-4">
          <h2 className="font-semibold">验收项核对</h2>
          {acceptanceItems.length === 0 ? (
            <p className="text-sm text-slate-500">暂无验收项</p>
          ) : (
            acceptanceItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                <div className="text-sm font-medium">{item.description}</div>
                {item.note ? <div className="mt-1 text-sm text-red-600">{item.note}</div> : null}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => reviewItem(item.id, true)}
                    className={`rounded-md px-2 py-1 text-xs ${
                      item.passed === true
                        ? "bg-green-100 text-green-700"
                        : "border border-slate-200"
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
                    className={`rounded-md px-2 py-1 text-xs ${
                      item.passed === false
                        ? "bg-red-100 text-red-700"
                        : "border border-slate-200"
                    }`}
                  >
                    退回开发
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">讨论</h2>
        <div className="space-y-3">
          {sortedComments.length === 0 ? (
            <p className="text-sm text-slate-500">暂无评论，写下第一条吧</p>
          ) : (
            sortedComments.map((c) => (
              <div key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="font-medium text-slate-800">
                  {c.author_name}
                  {c.author_role ? (
                    <span className="ml-2 font-normal text-slate-500">
                      {ROLE_LABELS[c.author_role as keyof typeof ROLE_LABELS] ?? c.author_role}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{c.body}</p>
                <div className="mt-1 text-xs text-slate-400">
                  {new Date(c.created_at).toLocaleString("zh-CN")}
                </div>
              </div>
            ))
          )}
        </div>
        <textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder="写下评论…"
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={pending || !commentBody.trim()}
          onClick={submitComment}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          发表评论
        </button>
      </section>
    </div>
  );
}
