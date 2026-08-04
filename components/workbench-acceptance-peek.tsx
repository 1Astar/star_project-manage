"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { StudioBadge } from "@/components/studio/shell";
import { fetchWorkbenchAcceptancePeekAction } from "@/lib/actions";
import type { PmAcceptanceItem } from "@/lib/workbench/pm-inbox";
import {
  CHANGE_SESSION_ACCEPTANCE_LABELS,
  type ChangeSession,
} from "@/lib/studio/types";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/types";

type PeekData = Awaited<ReturnType<typeof fetchWorkbenchAcceptancePeekAction>>;

type Props = {
  item: PmAcceptanceItem;
  onClose: () => void;
  onPass: () => void;
  onReject: () => void;
  pending?: boolean;
};

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h4 className="text-xs font-semibold text-slate-500">{title}</h4>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-slate-800">
        {items.map((t, i) => (
          <li key={`${title}-${i}`}>{t}</li>
        ))}
      </ul>
    </section>
  );
}

function SessionBody({ session }: { session: ChangeSession }) {
  return (
    <div className="space-y-4">
      <section>
        <h4 className="text-xs font-semibold text-slate-500">目标</h4>
        <p className="mt-1 text-sm text-slate-900">{session.goal}</p>
      </section>
      {session.reason ? (
        <section>
          <h4 className="text-xs font-semibold text-slate-500">原因</h4>
          <p className="mt-1 text-sm text-slate-700">{session.reason}</p>
        </section>
      ) : null}
      <ListBlock title="期望效果" items={session.expected ?? []} />
      <ListBlock title="已完成 ✅" items={session.doneItems ?? []} />
      <ListBlock title="未完成 ❌" items={session.pendingItems ?? []} />
      <ListBlock title="AI 操作" items={session.aiOps ?? []} />
      {session.result ? (
        <section>
          <h4 className="text-xs font-semibold text-slate-500">结果</h4>
          <p className="mt-1 text-sm text-slate-700">{session.result}</p>
        </section>
      ) : null}
      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
        {session.module ? <StudioBadge>{session.module}</StudioBadge> : null}
        <span>{session.day}</span>
        <span>{CHANGE_SESSION_ACCEPTANCE_LABELS[session.humanAcceptance]}</span>
        <span>{session.status === "finished" ? "已收工" : "进行中"}</span>
      </div>
    </div>
  );
}

export function WorkbenchAcceptancePeek({
  item,
  onClose,
  onPass,
  onReject,
  pending,
}: Props) {
  const [data, setData] = useState<PeekData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  useEffect(() => {
    setData(null);
    setError(null);
    startLoad(async () => {
      try {
        const peek = await fetchWorkbenchAcceptancePeekAction({
          changeSessionId: item.changeSessionId,
          requirementId: item.requirementId,
        });
        setData(peek);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      }
    });
  }, [item.id, item.changeSessionId, item.requirementId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30"
        aria-label="关闭"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StudioBadge tone={item.source === "formal" ? "p0" : "p1"}>
                {item.sourceLabel}
              </StudioBadge>
              <span className="text-xs text-slate-400">Side Peek</span>
            </div>
            <h3 className="mt-1 text-base font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {item.projectTitle}
              {item.note ? ` · ${item.note}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
          >
            关闭
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading && !data ? (
            <p className="text-sm text-slate-400">加载中…</p>
          ) : null}
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {data?.kind === "change_session" ? (
            <SessionBody session={data.session} />
          ) : null}
          {data?.kind === "requirement" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <StudioBadge>
                  {TASK_STATUS_LABELS[data.requirement.status as TaskStatus] ??
                    data.requirement.status}
                </StudioBadge>
                {data.requirement.priority ? (
                  <StudioBadge tone="muted">{data.requirement.priority}</StudioBadge>
                ) : null}
              </div>
              {data.requirement.detail_work ? (
                <section>
                  <h4 className="text-xs font-semibold text-slate-500">详情</h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                    {data.requirement.detail_work}
                  </p>
                </section>
              ) : null}
              {data.requirement.acceptance_criteria ? (
                <section>
                  <h4 className="text-xs font-semibold text-slate-500">验收标准</h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                    {data.requirement.acceptance_criteria}
                  </p>
                </section>
              ) : null}
              {data.requirement.next_step ? (
                <section>
                  <h4 className="text-xs font-semibold text-slate-500">下一步</h4>
                  <p className="mt-1 text-sm text-slate-700">{data.requirement.next_step}</p>
                </section>
              ) : null}
              {!data.requirement.detail_work &&
              !data.requirement.acceptance_criteria ? (
                <p className="text-sm text-slate-400">暂无更多正文，可全屏打开编辑</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            disabled={pending}
            onClick={onPass}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            通过
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onReject}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-rose-300 hover:text-rose-700 disabled:opacity-50"
          >
            打回·提 Bug
          </button>
          {item.liveSiteUrl ? (
            <a
              href={item.liveSiteUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              进入站点
            </a>
          ) : null}
          {data?.href ? (
            <Link
              href={data.href}
              className="ml-auto text-xs text-indigo-600 hover:underline"
            >
              全屏打开 →
            </Link>
          ) : (
            <Link
              href={item.href}
              className="ml-auto text-xs text-indigo-600 hover:underline"
            >
              全屏打开 →
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}
