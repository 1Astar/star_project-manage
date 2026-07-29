"use client";

import { useEffect } from "react";
import { StudioBadge } from "@/components/studio/shell";
import {
  EVOLUTION_TYPE_LABELS,
  type ChangeSession,
  type EvolutionLog,
  type Idea,
} from "@/lib/studio/types";

type PeekTarget =
  | { kind: "evolution"; log: EvolutionLog }
  | { kind: "idea"; idea: Idea }
  | { kind: "change"; session: ChangeSession };

type Props = {
  target: PeekTarget;
  onClose: () => void;
};

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <section>
      <h4 className="text-xs font-semibold text-slate-500">{label}</h4>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{value}</p>
    </section>
  );
}

function ListField({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <section>
      <h4 className="text-xs font-semibold text-slate-500">{label}</h4>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-slate-800">
        {items.map((t, i) => (
          <li key={`${label}-${i}`}>{t}</li>
        ))}
      </ul>
    </section>
  );
}

export function ModuleProgressPeek({ target, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title =
    target.kind === "evolution"
      ? target.log.title
      : target.kind === "idea"
        ? target.idea.title
        : target.session.goal || "变更会话";

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
              <StudioBadge>
                {target.kind === "evolution"
                  ? "演进"
                  : target.kind === "idea"
                    ? "灵感"
                    : "变更"}
              </StudioBadge>
              <span className="text-xs text-slate-400">Side Peek</span>
            </div>
            <h3 className="mt-1 text-base font-semibold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
          >
            关闭
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {target.kind === "evolution" ? (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <StudioBadge>{EVOLUTION_TYPE_LABELS[target.log.logType]}</StudioBadge>
                {target.log.module ? <StudioBadge tone="muted">{target.log.module}</StudioBadge> : null}
                {target.log.releaseTag ? (
                  <StudioBadge tone="muted">{target.log.releaseTag}</StudioBadge>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-red-50 p-3">
                  <div className="text-xs font-medium text-red-600">变化前</div>
                  <p className="mt-1 text-sm text-slate-700">{target.log.before || "—"}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <div className="text-xs font-medium text-green-600">变化后</div>
                  <p className="mt-1 text-sm text-slate-700">{target.log.after || "—"}</p>
                </div>
              </div>
              <Field label="为什么" value={target.log.reason} />
              <Field label="结论" value={target.log.decision} />
              {(target.log.workStartedAt || target.log.workFinishedAt) && (
                <Field
                  label="工时"
                  value={[target.log.workStartedAt, target.log.workFinishedAt]
                    .filter(Boolean)
                    .join(" → ")}
                />
              )}
              <Field label="记录时间" value={target.log.createdAt} />
            </>
          ) : null}

          {target.kind === "idea" ? (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                {target.idea.priority ? (
                  <StudioBadge tone="muted">{target.idea.priority}</StudioBadge>
                ) : null}
                {target.idea.relatedModule ? (
                  <StudioBadge>{target.idea.relatedModule}</StudioBadge>
                ) : null}
                <StudioBadge tone="muted">{target.idea.status}</StudioBadge>
              </div>
              <Field label="一句话" value={target.idea.oneLineIdea} />
              <Field label="为什么重要" value={target.idea.whyItMatters} />
              <Field label="AI 补充" value={target.idea.aiSupplement} />
              <Field label="下一步" value={target.idea.suggestedNextStep} />
              <Field label="原始输入" value={target.idea.rawInput} />
              <Field label="聊天主题" value={target.idea.chatTopic} />
            </>
          ) : null}

          {target.kind === "change" ? (
            <>
              <Field label="原因" value={target.session.reason} />
              <ListField label="期望效果" items={target.session.expected} />
              <ListField label="已完成" items={target.session.doneItems} />
              <ListField label="未完成" items={target.session.pendingItems} />
              <ListField label="AI 操作" items={target.session.aiOps} />
              <Field label="结果" value={target.session.result} />
              {target.session.module ? (
                <Field label="板块" value={target.session.module} />
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
