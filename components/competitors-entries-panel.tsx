"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCompetitorEntryAction,
  deleteCompetitorEntryAction,
  updateCompetitorEntryAction,
} from "@/lib/actions";
import {
  CrossLinkSection,
  type CrossLinkOption,
} from "@/components/cross-link-section";
import type { CompetitorEntry } from "@/lib/types";

export function CompetitorsEntriesPanel({
  projectId,
  projectSlug,
  initialEntries,
  learningOptions,
  requirementOptions,
  bugOptions,
}: {
  projectId: string;
  projectSlug: string;
  initialEntries: CompetitorEntry[];
  learningOptions: CrossLinkOption[];
  requirementOptions: CrossLinkOption[];
  bugOptions: CrossLinkOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entries, setEntries] = useState(initialEntries);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEntries[0]?.id ?? null
  );
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId]
  );

  function applyEntry(row: CompetitorEntry) {
    setEntries((prev) => {
      const i = prev.findIndex((e) => e.id === row.id);
      if (i < 0) return [row, ...prev];
      const next = [...prev];
      next[i] = row;
      return next;
    });
    setSelectedId(row.id);
  }

  function createEntry() {
    if (!newTitle.trim()) return;
    startTransition(async () => {
      try {
        const row = await createCompetitorEntryAction({
          projectId,
          projectSlug,
          title: newTitle.trim(),
        });
        applyEntry(row);
        setNewTitle("");
        setCreating(false);
        setMessage("已新建竞品条目");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "新建失败");
      }
    });
  }

  function saveSelected(patch: {
    title: string;
    summary: string;
    url: string;
    modulePath: string;
  }) {
    if (!selected) return;
    startTransition(async () => {
      try {
        const row = await updateCompetitorEntryAction({
          entryId: selected.id,
          projectSlug,
          title: patch.title,
          summary: patch.summary,
          url: patch.url || null,
          modulePath: patch.modulePath || null,
        });
        applyEntry(row);
        setMessage("已保存");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  function setLinks(
    field: "linkedLearningNoteIds" | "linkedRequirementIds" | "linkedBugIds",
    ids: string[]
  ) {
    if (!selected) return;
    startTransition(async () => {
      try {
        const row = await updateCompetitorEntryAction({
          entryId: selected.id,
          projectSlug,
          [field]: ids,
        });
        applyEntry(row);
        setMessage("已更新关联");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "关联失败");
      }
    });
  }

  function removeSelected() {
    if (!selected) return;
    if (!confirm(`删除竞品条目「${selected.title}」？`)) return;
    startTransition(async () => {
      try {
        await deleteCompetitorEntryAction({
          entryId: selected.id,
          projectSlug,
        });
        setEntries((prev) => {
          const next = prev.filter((e) => e.id !== selected.id);
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            竞品条目 · {entries.length}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            可被学习 / 需求 / Bug 交叉引用；也可在此手工新建并挂关联
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => setCreating((v) => !v)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {creating ? "取消" : "+ 新建条目"}
        </button>
      </div>

      {message ? (
        <p className="mt-2 text-xs text-slate-500">{message}</p>
      ) : null}

      {creating ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="竞品名称…"
            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || !newTitle.trim()}
            onClick={createEntry}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            创建
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,14rem)_1fr]">
        <ul className="max-h-[420px] space-y-1 overflow-auto rounded-xl border border-slate-100 p-2">
          {entries.length === 0 ? (
            <li className="px-2 py-6 text-center text-xs text-slate-400">
              暂无条目
            </li>
          ) : (
            entries.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(e.id)}
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-sm ${
                    e.id === selectedId
                      ? "bg-indigo-50 font-medium text-indigo-900"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="line-clamp-2">{e.title}</span>
                  <span className="mt-0.5 block text-[10px] text-slate-400">
                    学{e.linked_learning_note_ids.length} · 需
                    {e.linked_requirement_ids.length} · Bug
                    {e.linked_bug_ids.length}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        {selected ? (
          <CompetitorEntryEditor
            key={selected.id}
            entry={selected}
            pending={pending}
            learningOptions={learningOptions}
            requirementOptions={requirementOptions}
            bugOptions={bugOptions}
            onSave={saveSelected}
            onDelete={removeSelected}
            onLinkLearning={(id) =>
              setLinks("linkedLearningNoteIds", [
                ...selected.linked_learning_note_ids,
                id,
              ])
            }
            onUnlinkLearning={(id) =>
              setLinks(
                "linkedLearningNoteIds",
                selected.linked_learning_note_ids.filter((x) => x !== id)
              )
            }
            onLinkRequirement={(id) =>
              setLinks("linkedRequirementIds", [
                ...selected.linked_requirement_ids,
                id,
              ])
            }
            onUnlinkRequirement={(id) =>
              setLinks(
                "linkedRequirementIds",
                selected.linked_requirement_ids.filter((x) => x !== id)
              )
            }
            onLinkBug={(id) =>
              setLinks("linkedBugIds", [...selected.linked_bug_ids, id])
            }
            onUnlinkBug={(id) =>
              setLinks(
                "linkedBugIds",
                selected.linked_bug_ids.filter((x) => x !== id)
              )
            }
          />
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 p-8 text-sm text-slate-400">
            选择或新建一条竞品条目
          </p>
        )}
      </div>
    </section>
  );
}

function CompetitorEntryEditor({
  entry,
  pending,
  learningOptions,
  requirementOptions,
  bugOptions,
  onSave,
  onDelete,
  onLinkLearning,
  onUnlinkLearning,
  onLinkRequirement,
  onUnlinkRequirement,
  onLinkBug,
  onUnlinkBug,
}: {
  entry: CompetitorEntry;
  pending: boolean;
  learningOptions: CrossLinkOption[];
  requirementOptions: CrossLinkOption[];
  bugOptions: CrossLinkOption[];
  onSave: (patch: {
    title: string;
    summary: string;
    url: string;
    modulePath: string;
  }) => void;
  onDelete: () => void;
  onLinkLearning: (id: string) => void;
  onUnlinkLearning: (id: string) => void;
  onLinkRequirement: (id: string) => void;
  onUnlinkRequirement: (id: string) => void;
  onLinkBug: (id: string) => void;
  onUnlinkBug: (id: string) => void;
}) {
  const [title, setTitle] = useState(entry.title);
  const [summary, setSummary] = useState(entry.summary);
  const [url, setUrl] = useState(entry.url ?? "");
  const [modulePath, setModulePath] = useState(entry.module_path ?? "");

  return (
    <div className="space-y-3 rounded-xl border border-slate-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-slate-900 outline-none"
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
            onClick={() =>
              onSave({ title, summary, url, modulePath })
            }
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-xs text-slate-500">摘要</span>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-slate-500">外链</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-slate-500">板块路径</span>
          <input
            value={modulePath}
            onChange={(e) => setModulePath(e.target.value)}
            placeholder="存储·RAID…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <CrossLinkSection
        title="关联学习"
        linkedIds={entry.linked_learning_note_ids}
        options={learningOptions}
        pending={pending}
        pickPlaceholder="选择学习笔记…"
        onLink={onLinkLearning}
        onUnlink={onUnlinkLearning}
      />
      <CrossLinkSection
        title="关联需求"
        linkedIds={entry.linked_requirement_ids}
        options={requirementOptions}
        pending={pending}
        pickPlaceholder="选择需求…"
        onLink={onLinkRequirement}
        onUnlink={onUnlinkRequirement}
      />
      <CrossLinkSection
        title="关联 Bug"
        linkedIds={entry.linked_bug_ids}
        options={bugOptions}
        pending={pending}
        pickPlaceholder="选择 Bug…"
        onLink={onLinkBug}
        onUnlink={onUnlinkBug}
      />
    </div>
  );
}
