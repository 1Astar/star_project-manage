"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createLearningNoteAction,
  deleteLearningNoteAction,
  updateLearningNoteAction,
} from "@/lib/actions";
import type { ProjectLearningNote } from "@/lib/types";

const FIELDS: Array<{
  key: keyof Pick<
    ProjectLearningNote,
    | "why_text"
    | "principle"
    | "protocol"
    | "tech_background"
    | "competitors"
    | "product_thinking"
  >;
  label: string;
  placeholder: string;
}> = [
  { key: "why_text", label: "为什么？", placeholder: "为什么要学 / 为什么重要…" },
  { key: "principle", label: "原理", placeholder: "核心原理…" },
  { key: "protocol", label: "协议", placeholder: "相关协议 / 规范…" },
  { key: "tech_background", label: "技术背景", placeholder: "技术栈 / 实现背景…" },
  { key: "competitors", label: "竞品", placeholder: "竞品怎么做…" },
  {
    key: "product_thinking",
    label: "更底层的产品思考",
    placeholder: "产品层判断、取舍…",
  },
];

export function LearningPoolClient({
  projectId,
  projectSlug,
  initialNotes,
}: {
  projectId: string;
  projectSlug: string;
  initialNotes: ProjectLearningNote[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialNotes[0]?.id ?? null
  );
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId]
  );

  function createOne() {
    const title = newTitle.trim() || "未命名笔记";
    startTransition(async () => {
      try {
        const row = await createLearningNoteAction({
          projectId,
          projectSlug,
          title,
        });
        setNotes((prev) => [row, ...prev]);
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

  function saveSelected(
    patch: Partial<{
      title: string;
      whyText: string;
      principle: string;
      protocol: string;
      techBackground: string;
      competitors: string;
      productThinking: string;
    }>
  ) {
    if (!selected) return;
    startTransition(async () => {
      try {
        const row = await updateLearningNoteAction({
          noteId: selected.id,
          projectSlug,
          ...patch,
        });
        setNotes((prev) => prev.map((n) => (n.id === row.id ? row : n)));
        setMessage("已保存");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  function removeSelected() {
    if (!selected) return;
    if (!confirm(`删除学习笔记「${selected.title}」？`)) return;
    startTransition(async () => {
      try {
        await deleteLearningNoteAction({
          noteId: selected.id,
          projectSlug,
        });
        setNotes((prev) => {
          const next = prev.filter((n) => n.id !== selected.id);
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
          <h2 className="text-base font-semibold text-slate-900">学习池</h2>
          <p className="text-xs text-slate-500">
            为什么 · 原理 · 协议 · 技术背景 · 竞品 · 产品思考 · 共 {notes.length} 条
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          {creating ? "收起" : "+ 新建笔记"}
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
              placeholder="例如：SMB / AFP 选型 · 家庭相册场景"
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
          {notes.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">还没有笔记，先新建一条。</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {notes.map((note) => (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(note.id)}
                    className={`w-full px-3 py-2.5 text-left transition ${
                      selectedId === note.id
                        ? "bg-indigo-50 text-indigo-900"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-sm font-medium line-clamp-2">{note.title}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {new Date(note.updated_at).toLocaleString("zh-CN")}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {selected ? (
          <LearningNoteEditor
            key={selected.id}
            note={selected}
            pending={pending}
            onSave={saveSelected}
            onDelete={removeSelected}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-400">
            选择或新建一条学习笔记
          </div>
        )}
      </div>
    </div>
  );
}

function LearningNoteEditor({
  note,
  pending,
  onSave,
  onDelete,
}: {
  note: ProjectLearningNote;
  pending: boolean;
  onSave: (
    patch: Partial<{
      title: string;
      whyText: string;
      principle: string;
      protocol: string;
      techBackground: string;
      competitors: string;
      productThinking: string;
    }>
  ) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [draft, setDraft] = useState({
    why_text: note.why_text,
    principle: note.principle,
    protocol: note.protocol,
    tech_background: note.tech_background,
    competitors: note.competitors,
    product_thinking: note.product_thinking,
  });

  function saveAll() {
    onSave({
      title,
      whyText: draft.why_text,
      principle: draft.principle,
      protocol: draft.protocol,
      techBackground: draft.tech_background,
      competitors: draft.competitors,
      productThinking: draft.product_thinking,
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent text-lg font-semibold text-slate-900 outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600"
          >
            删除
          </button>
          <button
            type="button"
            disabled={pending || !title.trim()}
            onClick={saveAll}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      {FIELDS.map((field) => (
        <section key={field.key} className="space-y-1.5 border-t border-slate-100 pt-3">
          <h4 className="text-xs font-semibold text-slate-500">{field.label}</h4>
          <textarea
            value={draft[field.key]}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
            }
            rows={3}
            placeholder={field.placeholder}
            className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
          />
        </section>
      ))}
    </div>
  );
}
