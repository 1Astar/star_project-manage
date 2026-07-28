"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StudioBadge } from "@/components/studio/shell";
import {
  CHANGE_SESSION_ACCEPTANCE_LABELS,
  type ChangeSession,
  type ChangeSessionAcceptance,
} from "@/lib/studio/types";
import { cn } from "@/lib/utils";

type Props = {
  projectId: string;
  sessions: ChangeSession[];
};

function linesToText(items: string[]) {
  return items.join("\n");
}

function textToLines(raw: string) {
  return raw
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ProjectChangeSessions({ projectId, sessions }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(sessions[0]?.id ?? null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    goal: "",
    reason: "",
    expected: "",
    module: "",
  });

  const byDay = useMemo(() => {
    const map = new Map<string, ChangeSession[]>();
    for (const s of sessions) {
      const list = map.get(s.day) ?? [];
      list.push(s);
      map.set(s.day, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [sessions]);

  function patchSession(id: string, body: Record<string, unknown>) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/studio/change-sessions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(json.error || "保存失败");
        setMessage("已保存");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      }
    });
  }

  function createSession(e: React.FormEvent) {
    e.preventDefault();
    if (!form.goal.trim()) {
      setMessage("修改目标必填");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/studio/change-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            goal: form.goal.trim(),
            reason: form.reason.trim(),
            expected: textToLines(form.expected),
            module: form.module.trim() || undefined,
          }),
        });
        const json = (await res.json()) as { error?: string; session?: ChangeSession };
        if (!res.ok) throw new Error(json.error || "创建失败");
        setForm({ goal: "", reason: "", expected: "", module: "" });
        setShowForm(false);
        if (json.session) setExpandedId(json.session.id);
        setMessage("已开变更会话");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "创建失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-slate-500">
          按日汇总 AI 变更会话；改前写目标/原因/期望，改后勾执行项，人工点验收。也可用 MCP
          start/finish_change_session。
        </p>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {showForm ? "收起" : "+ 开一条变更"}
        </button>
      </div>

      {message ? <p className="text-xs text-slate-600">{message}</p> : null}

      {showForm ? (
        <form
          onSubmit={createSession}
          className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4"
        >
          <label className="block text-sm">
            <span className="text-slate-500">修改目标</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={form.goal}
              onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">修改原因</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              rows={2}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">期望效果（每行一条）</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              rows={3}
              value={form.expected}
              onChange={(e) => setForm((f) => ({ ...f, expected: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">板块（可选）</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={form.module}
              onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))}
              placeholder="如 迭代记录"
            />
          </label>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "保存中…" : "开会话"}
          </button>
        </form>
      ) : null}

      {byDay.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          暂无变更会话。改东西前点「开一条变更」，或用 MCP start_change_session。
        </p>
      ) : (
        byDay.map(([day, list]) => (
          <section key={day} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">
              # {day}
              <span className="ml-2 font-normal text-slate-400">{list.length} 条</span>
            </h3>
            {list.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                expanded={expandedId === session.id}
                pending={pending}
                onToggle={() =>
                  setExpandedId((id) => (id === session.id ? null : session.id))
                }
                onPatch={(body) => patchSession(session.id, body)}
              />
            ))}
          </section>
        ))
      )}
    </div>
  );
}

function SessionCard({
  session,
  expanded,
  pending,
  onToggle,
  onPatch,
}: {
  session: ChangeSession;
  expanded: boolean;
  pending: boolean;
  onToggle: () => void;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState({
    goal: session.goal,
    reason: session.reason,
    expected: linesToText(session.expected),
    doneItems: linesToText(session.doneItems),
    pendingItems: linesToText(session.pendingItems),
    aiOps: linesToText(session.aiOps),
    result: session.result,
    module: session.module,
  });

  useEffect(() => {
    setDraft({
      goal: session.goal,
      reason: session.reason,
      expected: linesToText(session.expected),
      doneItems: linesToText(session.doneItems),
      pendingItems: linesToText(session.pendingItems),
      aiOps: linesToText(session.aiOps),
      result: session.result,
      module: session.module,
    });
  }, [session]);

  const acceptanceTone =
    session.humanAcceptance === "passed"
      ? "mainline"
      : session.humanAcceptance === "rejected"
        ? "warning"
        : "muted";

  return (
    <article className="rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="text-sm font-semibold text-slate-900">{session.goal || "（无目标）"}</span>
        <StudioBadge tone={session.status === "finished" ? "muted" : "p1"}>
          {session.status === "finished" ? "已收尾" : "进行中"}
        </StudioBadge>
        <StudioBadge tone={acceptanceTone}>
          {CHANGE_SESSION_ACCEPTANCE_LABELS[session.humanAcceptance]}
        </StudioBadge>
        {session.module ? <StudioBadge>{session.module}</StudioBadge> : null}
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-slate-100 px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="修改目标"
              value={draft.goal}
              onChange={(v) => setDraft((d) => ({ ...d, goal: v }))}
            />
            <Field
              label="板块"
              value={draft.module}
              onChange={(v) => setDraft((d) => ({ ...d, module: v }))}
            />
            <Field
              label="修改原因"
              value={draft.reason}
              onChange={(v) => setDraft((d) => ({ ...d, reason: v }))}
              multiline
              className="md:col-span-2"
            />
            <Field
              label="期望效果（每行一条）"
              value={draft.expected}
              onChange={(v) => setDraft((d) => ({ ...d, expected: v }))}
              multiline
            />
            <Field
              label="结果"
              value={draft.result}
              onChange={(v) => setDraft((d) => ({ ...d, result: v }))}
              multiline
            />
            <Field
              label="✅ 已完成（每行一条）"
              value={draft.doneItems}
              onChange={(v) => setDraft((d) => ({ ...d, doneItems: v }))}
              multiline
            />
            <Field
              label="❌ 未完成（每行一条）"
              value={draft.pendingItems}
              onChange={(v) => setDraft((d) => ({ ...d, pendingItems: v }))}
              multiline
            />
            <Field
              label="AI 操作"
              value={draft.aiOps}
              onChange={(v) => setDraft((d) => ({ ...d, aiOps: v }))}
              multiline
              className="md:col-span-2"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                onPatch({
                  goal: draft.goal,
                  reason: draft.reason,
                  expected: textToLines(draft.expected),
                  doneItems: textToLines(draft.doneItems),
                  pendingItems: textToLines(draft.pendingItems),
                  aiOps: textToLines(draft.aiOps),
                  result: draft.result,
                  module: draft.module,
                })
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              保存修改
            </button>
            {session.status !== "finished" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  onPatch({
                    action: "finish",
                    doneItems: textToLines(draft.doneItems),
                    pendingItems: textToLines(draft.pendingItems),
                    aiOps: textToLines(draft.aiOps),
                    result: draft.result,
                    goal: draft.goal,
                    reason: draft.reason,
                    expected: textToLines(draft.expected),
                  })
                }
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                标记收尾
              </button>
            ) : null}
            {(
              [
                ["passed", "验收通过"],
                ["rejected", "验收退回"],
                ["unreviewed", "重置未验收"],
              ] as Array<[ChangeSessionAcceptance, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={pending || session.humanAcceptance === value}
                onClick={() => onPatch({ humanAcceptance: value })}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40",
                  value === "passed"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : value === "rejected"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-slate-200 bg-white text-slate-600"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="text-slate-500">{label}</span>
      {multiline ? (
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
