"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addLearningSuggestionAction,
  createLearningNoteAction,
  deleteLearningNoteAction,
  generateRequirementFromLearningSuggestionAction,
  linkLearningNoteRequirementAction,
  unlinkLearningNoteRequirementAction,
  updateLearningNoteAction,
  updateLearningSuggestionAction,
} from "@/lib/actions";
import type { LearningSuggestion, ProjectLearningNote } from "@/lib/types";

export type LearningReqOption = {
  id: string;
  title: string;
};

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
  requirements,
}: {
  projectId: string;
  projectSlug: string;
  initialNotes: ProjectLearningNote[];
  requirements: LearningReqOption[];
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

  const reqById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of requirements) m.set(r.id, r.title);
    return m;
  }, [requirements]);

  function applyNote(row: ProjectLearningNote) {
    setNotes((prev) => prev.map((n) => (n.id === row.id ? row : n)));
  }

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
        applyNote(row);
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

  function linkRequirement(requirementId: string) {
    if (!selected || !requirementId) return;
    startTransition(async () => {
      try {
        const row = await linkLearningNoteRequirementAction({
          noteId: selected.id,
          projectSlug,
          requirementId,
        });
        applyNote(row);
        setMessage("已关联需求");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "关联失败");
      }
    });
  }

  function unlinkRequirement(requirementId: string) {
    if (!selected) return;
    startTransition(async () => {
      try {
        const row = await unlinkLearningNoteRequirementAction({
          noteId: selected.id,
          projectSlug,
          requirementId,
        });
        applyNote(row);
        setMessage("已取消关联");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "取消失败");
      }
    });
  }

  function addSuggestion(title: string, detail: string) {
    if (!selected || !title.trim()) return;
    startTransition(async () => {
      try {
        const { note } = await addLearningSuggestionAction({
          noteId: selected.id,
          projectSlug,
          title,
          detail,
        });
        applyNote(note);
        setMessage("已添加优化建议");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "添加失败");
      }
    });
  }

  function patchSuggestion(
    suggestionId: string,
    patch: { title?: string; detail?: string; remove?: boolean }
  ) {
    if (!selected) return;
    startTransition(async () => {
      try {
        const row = await updateLearningSuggestionAction({
          noteId: selected.id,
          projectSlug,
          suggestionId,
          ...patch,
        });
        applyNote(row);
        setMessage(patch.remove ? "已删除建议" : "已更新建议");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "更新失败");
      }
    });
  }

  function generateFromSuggestion(suggestionId: string) {
    if (!selected) return;
    startTransition(async () => {
      try {
        const result = await generateRequirementFromLearningSuggestionAction({
          noteId: selected.id,
          projectId,
          projectSlug,
          suggestionId,
        });
        applyNote(result.note);
        setMessage(
          result.created
            ? "已生成需求并挂上本笔记"
            : "该建议已关联过需求（未重复创建）"
        );
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "生成需求失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">学习池</h2>
          <p className="text-xs text-slate-500">
            为什么 · 原理 · 协议 · 技术背景 · 竞品 · 产品思考 · 关联需求 · 优化建议 · 共{" "}
            {notes.length} 条
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
                    <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
                      <span>{new Date(note.updated_at).toLocaleString("zh-CN")}</span>
                      {(note.linked_requirement_ids?.length ?? 0) > 0 ? (
                        <span>需求 {note.linked_requirement_ids.length}</span>
                      ) : null}
                      {(note.suggestions?.length ?? 0) > 0 ? (
                        <span>建议 {note.suggestions.length}</span>
                      ) : null}
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
            projectSlug={projectSlug}
            requirements={requirements}
            reqById={reqById}
            pending={pending}
            onSave={saveSelected}
            onDelete={removeSelected}
            onLinkRequirement={linkRequirement}
            onUnlinkRequirement={unlinkRequirement}
            onAddSuggestion={addSuggestion}
            onPatchSuggestion={patchSuggestion}
            onGenerateRequirement={generateFromSuggestion}
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
  projectSlug,
  requirements,
  reqById,
  pending,
  onSave,
  onDelete,
  onLinkRequirement,
  onUnlinkRequirement,
  onAddSuggestion,
  onPatchSuggestion,
  onGenerateRequirement,
}: {
  note: ProjectLearningNote;
  projectSlug: string;
  requirements: LearningReqOption[];
  reqById: Map<string, string>;
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
  onLinkRequirement: (requirementId: string) => void;
  onUnlinkRequirement: (requirementId: string) => void;
  onAddSuggestion: (title: string, detail: string) => void;
  onPatchSuggestion: (
    suggestionId: string,
    patch: { title?: string; detail?: string; remove?: boolean }
  ) => void;
  onGenerateRequirement: (suggestionId: string) => void;
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
  const [linkPick, setLinkPick] = useState("");
  const [sugTitle, setSugTitle] = useState("");
  const [sugDetail, setSugDetail] = useState("");

  const linkedIds = note.linked_requirement_ids ?? [];
  const suggestions = note.suggestions ?? [];
  const linkable = requirements.filter((r) => !linkedIds.includes(r.id));

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

      <section className="space-y-2 border-t border-slate-100 pt-3">
        <h4 className="text-xs font-semibold text-slate-500">关联需求</h4>
        {linkedIds.length === 0 ? (
          <p className="text-xs text-slate-400">尚未关联需求。可从下方选择已有需求，或先写优化建议再一键生成。</p>
        ) : (
          <ul className="space-y-1.5">
            {linkedIds.map((id) => (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
              >
                <Link
                  href={`/projects/${projectSlug}/requirements/${id}`}
                  className="min-w-0 flex-1 text-indigo-700 hover:underline"
                >
                  {reqById.get(id) ?? id}
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onUnlinkRequirement(id)}
                  className="shrink-0 text-xs text-slate-500 hover:text-red-600"
                >
                  取消关联
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <select
            value={linkPick}
            onChange={(e) => setLinkPick(e.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">选择需求池条目…</option>
            {linkable.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !linkPick}
            onClick={() => {
              onLinkRequirement(linkPick);
              setLinkPick("");
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
          >
            挂上
          </button>
        </div>
      </section>

      <section className="space-y-2 border-t border-slate-100 pt-3">
        <h4 className="text-xs font-semibold text-slate-500">优化建议</h4>
        <p className="text-[11px] text-slate-400">
          先记建议，不自动建需求；点「一键生成需求」才会进需求池并回写关联。
        </p>
        {suggestions.length === 0 ? (
          <p className="text-xs text-slate-400">还没有优化建议。</p>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                projectSlug={projectSlug}
                reqTitle={
                  s.linked_requirement_id
                    ? reqById.get(s.linked_requirement_id) ?? s.linked_requirement_id
                    : null
                }
                pending={pending}
                onSave={(title, detail) =>
                  onPatchSuggestion(s.id, { title, detail })
                }
                onRemove={() => onPatchSuggestion(s.id, { remove: true })}
                onGenerate={() => onGenerateRequirement(s.id)}
              />
            ))}
          </ul>
        )}
        <div className="space-y-2 rounded-lg border border-dashed border-slate-200 p-3">
          <input
            value={sugTitle}
            onChange={(e) => setSugTitle(e.target.value)}
            placeholder="建议标题，例如：创建存储池向导问意图而非甩 RAID"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            value={sugDetail}
            onChange={(e) => setSugDetail(e.target.value)}
            rows={2}
            placeholder="补充说明（可选）"
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || !sugTitle.trim()}
            onClick={() => {
              onAddSuggestion(sugTitle, sugDetail);
              setSugTitle("");
              setSugDetail("");
            }}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            添加建议
          </button>
        </div>
      </section>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  projectSlug,
  reqTitle,
  pending,
  onSave,
  onRemove,
  onGenerate,
}: {
  suggestion: LearningSuggestion;
  projectSlug: string;
  reqTitle: string | null;
  pending: boolean;
  onSave: (title: string, detail: string) => void;
  onRemove: () => void;
  onGenerate: () => void;
}) {
  const [title, setTitle] = useState(suggestion.title);
  const [detail, setDetail] = useState(suggestion.detail);
  const linked = Boolean(suggestion.linked_requirement_id);

  return (
    <li className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium"
      />
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        rows={2}
        className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
      />
      {linked && suggestion.linked_requirement_id ? (
        <p className="text-xs text-emerald-700">
          已生成需求：{" "}
          <Link
            href={`/projects/${projectSlug}/requirements/${suggestion.linked_requirement_id}`}
            className="underline"
          >
            {reqTitle}
          </Link>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !title.trim()}
          onClick={() => onSave(title, detail)}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 disabled:opacity-50"
        >
          保存建议
        </button>
        <button
          type="button"
          disabled={pending || linked}
          onClick={onGenerate}
          className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
          title={linked ? "已关联需求" : "写入需求池并挂回本笔记"}
        >
          {linked ? "已生成需求" : "一键生成需求"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("删除这条优化建议？")) onRemove();
          }}
          className="rounded-md px-2.5 py-1 text-xs text-red-600"
        >
          删除
        </button>
      </div>
    </li>
  );
}
