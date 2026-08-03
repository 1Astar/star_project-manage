"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createInterviewAction,
  deleteInterviewAction,
  updateInterviewAction,
} from "@/lib/actions";
import {
  INTERVIEW_HYPOTHESIS_STATUS_LABELS,
  type InterviewHypothesis,
  type InterviewHypothesisStatus,
  type ProjectInterview,
} from "@/lib/types";

function newHypothesis(statement = ""): InterviewHypothesis {
  return {
    id: `ih-${crypto.randomUUID().slice(0, 10)}`,
    statement,
    status: "open",
  };
}

export function InterviewsClient({
  projectId,
  projectSlug,
  initialInterviews,
}: {
  projectId: string;
  projectSlug: string;
  initialInterviews: ProjectInterview[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [interviews, setInterviews] = useState(initialInterviews);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialInterviews[0]?.id ?? null
  );
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const selected = useMemo(
    () => interviews.find((i) => i.id === selectedId) ?? null,
    [interviews, selectedId]
  );

  function createOne() {
    const title = newTitle.trim() || "未命名访谈";
    startTransition(async () => {
      try {
        const row = await createInterviewAction({
          projectId,
          projectSlug,
          title,
        });
        setInterviews((prev) => [row, ...prev]);
        setSelectedId(row.id);
        setNewTitle("");
        setCreating(false);
        setMessage("已创建");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "创建失败");
      }
    });
  }

  function saveSelected(patch: {
    title?: string;
    interviewee?: string | null;
    interviewedAt?: string | null;
    recordNotes?: string;
    productJudgment?: string;
    hypotheses?: InterviewHypothesis[];
  }) {
    if (!selected) return;
    startTransition(async () => {
      try {
        const row = await updateInterviewAction({
          interviewId: selected.id,
          projectSlug,
          ...patch,
        });
        setInterviews((prev) => prev.map((i) => (i.id === row.id ? row : i)));
        setMessage("已保存");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  function removeSelected() {
    if (!selected) return;
    if (!confirm(`删除访谈「${selected.title}」？`)) return;
    startTransition(async () => {
      try {
        await deleteInterviewAction({
          interviewId: selected.id,
          projectSlug,
        });
        setInterviews((prev) => {
          const next = prev.filter((i) => i.id !== selected.id);
          setSelectedId(next[0]?.id ?? null);
          return next;
        });
        setMessage("已删除");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">访谈库</h2>
          <p className="text-xs text-slate-500">
            访谈记录 · 产品判断 · 待验证假设 · 共 {interviews.length} 条
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          {creating ? "收起" : "+ 新建访谈"}
        </button>
      </div>

      {message ? <p className="text-xs text-slate-500">{message}</p> : null}

      {creating ? (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <label className="min-w-[200px] flex-1 space-y-1 text-sm">
            <span className="text-xs text-slate-500">标题</span>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="例如：渠道运营访谈 · 周报痛点"
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={createOne}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            创建
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
        <aside className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white">
          {interviews.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">还没有访谈，先新建一条。</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {interviews.map((iv) => (
                <li key={iv.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(iv.id)}
                    className={`w-full px-3 py-2.5 text-left transition ${
                      selectedId === iv.id
                        ? "bg-indigo-50 text-indigo-900"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-sm font-medium line-clamp-2">{iv.title}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {iv.interviewee || "未填对象"} · 假设 {iv.hypotheses.length}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {selected ? (
          <InterviewEditor
            key={selected.id}
            interview={selected}
            pending={pending}
            onSave={saveSelected}
            onDelete={removeSelected}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-400">
            选择或新建一条访谈
          </div>
        )}
      </div>
    </div>
  );
}

function InterviewEditor({
  interview,
  pending,
  onSave,
  onDelete,
}: {
  interview: ProjectInterview;
  pending: boolean;
  onSave: (patch: {
    title?: string;
    interviewee?: string | null;
    interviewedAt?: string | null;
    recordNotes?: string;
    productJudgment?: string;
    hypotheses?: InterviewHypothesis[];
  }) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(interview.title);
  const [interviewee, setInterviewee] = useState(interview.interviewee ?? "");
  const [interviewedAt, setInterviewedAt] = useState(
    interview.interviewed_at ? interview.interviewed_at.slice(0, 16) : ""
  );
  const [recordNotes, setRecordNotes] = useState(interview.record_notes);
  const [judgment, setJudgment] = useState(interview.product_judgment);
  const [hypotheses, setHypotheses] = useState<InterviewHypothesis[]>(
    interview.hypotheses.length ? interview.hypotheses : [newHypothesis()]
  );

  function persistAll() {
    onSave({
      title,
      interviewee: interviewee || null,
      interviewedAt: interviewedAt ? new Date(interviewedAt).toISOString() : null,
      recordNotes,
      productJudgment: judgment,
      hypotheses: hypotheses.filter((h) => h.statement.trim()),
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-base font-semibold"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={persistAll}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            保存
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600"
          >
            删除
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-slate-500">访谈对象</span>
          <input
            value={interviewee}
            onChange={(e) => setInterviewee(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-slate-500">访谈时间</span>
          <input
            type="datetime-local"
            value={interviewedAt}
            onChange={(e) => setInterviewedAt(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      <section className="space-y-1.5">
        <h3 className="text-sm font-semibold text-slate-800">1. 访谈记录</h3>
        <textarea
          value={recordNotes}
          onChange={(e) => setRecordNotes(e.target.value)}
          rows={6}
          placeholder="原话摘要、场景、痛点、原话引用…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed"
        />
      </section>

      <section className="space-y-1.5">
        <h3 className="text-sm font-semibold text-slate-800">2. 产品判断</h3>
        <textarea
          value={judgment}
          onChange={(e) => setJudgment(e.target.value)}
          rows={4}
          placeholder="我们怎么解读？要不要做？优先级与边界…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed"
        />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">3. 待验证假设</h3>
          <button
            type="button"
            onClick={() => setHypotheses((prev) => [...prev, newHypothesis()])}
            className="text-xs text-indigo-600 hover:underline"
          >
            + 加一条
          </button>
        </div>
        <div className="space-y-2">
          {hypotheses.map((h, idx) => (
            <div
              key={h.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2 sm:flex-row sm:items-center"
            >
              <input
                value={h.statement}
                onChange={(e) =>
                  setHypotheses((prev) =>
                    prev.map((x, i) =>
                      i === idx ? { ...x, statement: e.target.value } : x
                    )
                  )
                }
                placeholder="如果…那么…（可证伪）"
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
              />
              <select
                value={h.status}
                onChange={(e) =>
                  setHypotheses((prev) =>
                    prev.map((x, i) =>
                      i === idx
                        ? { ...x, status: e.target.value as InterviewHypothesisStatus }
                        : x
                    )
                  )
                }
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
              >
                {(
                  Object.keys(INTERVIEW_HYPOTHESIS_STATUS_LABELS) as InterviewHypothesisStatus[]
                ).map((s) => (
                  <option key={s} value={s}>
                    {INTERVIEW_HYPOTHESIS_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setHypotheses((prev) => prev.filter((_, i) => i !== idx))
                }
                className="text-xs text-slate-400 hover:text-rose-600"
              >
                删
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
