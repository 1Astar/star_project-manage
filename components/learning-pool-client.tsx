"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addLearningSuggestionAction,
  createLearningNoteAction,
  deleteLearningNoteAction,
  generateRequirementFromLearningSuggestionAction,
  linkLearningNoteRequirementAction,
  unlinkLearningNoteRequirementAction,
  updateBugAction,
  updateCompetitorEntryAction,
  updateLearningNoteAction,
  updateLearningSuggestionAction,
} from "@/lib/actions";
import type {
  LearningNoteAttachment,
  LearningNoteKind,
  LearningSuggestion,
  ProjectLearningNote,
} from "@/lib/types";
import { WorkbookImportPanel } from "@/components/workbook-import-panel";
import { LearningAttachmentsBlock } from "@/components/learning-attachments";
import {
  CrossLinkSection,
  type CrossLinkOption,
} from "@/components/cross-link-section";
import {
  EntitySidePeek,
  type EntityPeekPayload,
} from "@/components/entity-side-peek";

export type LearningReqOption = CrossLinkOption;

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

const KIND_LABEL: Record<LearningNoteKind, string> = {
  section: "板块",
  topic: "主题",
  point: "子知识",
};

type TreeRow =
  | { type: "orphan-header"; key: string }
  | { type: "note"; note: ProjectLearningNote; depth: number };

function buildTreeRows(notes: ProjectLearningNote[]): TreeRow[] {
  const byParent = new Map<string | null, ProjectLearningNote[]>();
  for (const n of notes) {
    const key = n.parent_id;
    const list = byParent.get(key) ?? [];
    list.push(n);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.title.localeCompare(b.title, "zh-CN");
    });
  }

  const rows: TreeRow[] = [];
  const sections = (byParent.get(null) ?? []).filter((n) => n.kind === "section");
  const orphanTopics = (byParent.get(null) ?? []).filter((n) => n.kind !== "section");

  function pushBranch(note: ProjectLearningNote, depth: number) {
    rows.push({ type: "note", note, depth });
    const kids = byParent.get(note.id) ?? [];
    for (const kid of kids) pushBranch(kid, depth + 1);
  }

  for (const s of sections) pushBranch(s, 0);

  if (orphanTopics.length) {
    rows.push({ type: "orphan-header", key: "orphan" });
    for (const t of orphanTopics) pushBranch(t, 0);
  }

  return rows;
}

function countDescendants(notes: ProjectLearningNote[], rootId: string): number {
  const byParent = new Map<string, ProjectLearningNote[]>();
  for (const n of notes) {
    if (!n.parent_id) continue;
    const list = byParent.get(n.parent_id) ?? [];
    list.push(n);
    byParent.set(n.parent_id, list);
  }
  let count = 0;
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    const kids = byParent.get(id) ?? [];
    for (const k of kids) {
      count += 1;
      stack.push(k.id);
    }
  }
  return count;
}

export function LearningPoolClient({
  projectId,
  projectSlug,
  initialNotes,
  initialAttachments = [],
  requirements,
  competitorOptions = [],
  bugOptions = [],
}: {
  projectId: string;
  projectSlug: string;
  initialNotes: ProjectLearningNote[];
  initialAttachments?: LearningNoteAttachment[];
  requirements: LearningReqOption[];
  competitorOptions?: CrossLinkOption[];
  bugOptions?: CrossLinkOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes);
  const [attachments, setAttachments] = useState(initialAttachments);
  useEffect(() => {
    setAttachments(initialAttachments);
  }, [initialAttachments]);
  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialNotes[0]?.id ?? null
  );
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<LearningNoteKind>("section");
  const [newParentId, setNewParentId] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId]
  );

  const selectedAttachments = useMemo(
    () =>
      selected
        ? attachments.filter((a) => a.note_id === selected.id)
        : [],
    [attachments, selected]
  );

  const reqById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of requirements) m.set(r.id, r.title);
    return m;
  }, [requirements]);

  const treeRows = useMemo(() => buildTreeRows(notes), [notes]);

  const visibleRows = useMemo(() => {
    const hidden = new Set<string>();
    for (const [id, isCollapsed] of Object.entries(collapsed)) {
      if (!isCollapsed) continue;
      for (const n of notes) {
        if (isDescendantOf(notes, n.id, id)) hidden.add(n.id);
      }
    }
    return treeRows.filter((row) => {
      if (row.type === "orphan-header") return true;
      return !hidden.has(row.note.id);
    });
  }, [treeRows, collapsed, notes]);

  const sectionOptions = useMemo(
    () => notes.filter((n) => n.kind === "section").sort(bySort),
    [notes]
  );
  const topicOptions = useMemo(
    () => notes.filter((n) => n.kind === "topic").sort(bySort),
    [notes]
  );

  function applyNote(row: ProjectLearningNote) {
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === row.id);
      if (idx < 0) return [row, ...prev];
      const next = [...prev];
      next[idx] = row;
      return next;
    });
  }

  function createOne() {
    const title = newTitle.trim() || undefined;
    if (newKind === "topic" && !newParentId) {
      // 允许未分板块：parent 空
    }
    if (newKind === "point" && !newParentId) {
      setMessage("子知识点请选择所属主题");
      return;
    }
    startTransition(async () => {
      try {
        const row = await createLearningNoteAction({
          projectId,
          projectSlug,
          title: title || "",
          kind: newKind,
          parentId:
            newKind === "section"
              ? null
              : newParentId.trim()
                ? newParentId
                : null,
        });
        setNotes((prev) => [...prev, row]);
        setSelectedId(row.id);
        setNewTitle("");
        setCreating(false);
        setMessage(`已创建${KIND_LABEL[row.kind]}`);
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "创建失败");
      }
    });
  }

  function startCreateUnder(parent: ProjectLearningNote) {
    if (parent.kind === "section") {
      setNewKind("topic");
      setNewParentId(parent.id);
    } else if (parent.kind === "topic") {
      setNewKind("point");
      setNewParentId(parent.id);
    } else {
      return;
    }
    setCreating(true);
    setNewTitle("");
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
      parentId: string | null;
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
    const childCount = countDescendants(notes, selected.id);
    const tip =
      childCount > 0
        ? `删除「${selected.title}」及其下 ${childCount} 个子节点？不可恢复。`
        : `删除「${selected.title}」？`;
    if (!confirm(tip)) return;
    startTransition(async () => {
      try {
        await deleteLearningNoteAction({
          noteId: selected.id,
          projectSlug,
        });
        setNotes((prev) => {
          const removeIds = new Set([
            selected.id,
            ...collectDescendantIdList(prev, selected.id),
          ]);
          const next = prev.filter((n) => !removeIds.has(n.id));
          setSelectedId(next[0]?.id ?? null);
          setAttachments((atts) => atts.filter((a) => !removeIds.has(a.note_id)));
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

  function setNoteLinks(
    field: "linkedCompetitorIds" | "linkedBugIds",
    ids: string[]
  ) {
    if (!selected) return;
    startTransition(async () => {
      try {
        const row = await updateLearningNoteAction({
          noteId: selected.id,
          projectSlug,
          [field]: ids,
        });
        applyNote(row);
        setMessage("已更新关联");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "关联失败");
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

  const parentChoices =
    newKind === "topic"
      ? sectionOptions
      : newKind === "point"
        ? topicOptions
        : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">学习池</h2>
          <p className="text-xs text-slate-500">
            板块 → 主题 → 子知识 · 关联需求 · 优化建议 · 共 {notes.length} 条
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreating((v) => !v);
            if (!creating) {
              setNewKind("section");
              setNewParentId("");
            }
          }}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          {creating ? "收起" : "+ 新建"}
        </button>
      </div>

      <WorkbookImportPanel projectSlug={projectSlug} compact />

      {message ? <p className="text-xs text-slate-500">{message}</p> : null}

      {creating ? (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-slate-500">类型</span>
            <select
              value={newKind}
              onChange={(e) => {
                const k = e.target.value as LearningNoteKind;
                setNewKind(k);
                setNewParentId("");
              }}
              className="block rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="section">板块</option>
              <option value="topic">主题</option>
              <option value="point">子知识</option>
            </select>
          </label>
          {newKind !== "section" ? (
            <label className="min-w-[180px] flex-1 space-y-1 text-sm">
              <span className="text-xs text-slate-500">
                {newKind === "topic" ? "所属板块（可空=未分板块）" : "所属主题"}
              </span>
              <select
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="">
                  {newKind === "topic" ? "未分板块" : "请选择主题…"}
                </option>
                {parentChoices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="min-w-[200px] flex-1 space-y-1 text-sm">
            <span className="text-xs text-slate-500">标题</span>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={
                newKind === "section"
                  ? "例如：存储"
                  : newKind === "topic"
                    ? "例如：RAID 0（条带化）"
                    : "例如：容量利用率与故障边界"
              }
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

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
        <aside className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white">
          {notes.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">还没有内容，先新建一个板块。</p>
          ) : (
            <ul className="py-1">
              {visibleRows.map((row) => {
                if (row.type === "orphan-header") {
                  return (
                    <li
                      key={row.key}
                      className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                    >
                      未分板块
                    </li>
                  );
                }
                const { note, depth } = row;
                const hasKids = notes.some((n) => n.parent_id === note.id);
                const isCollapsed = Boolean(collapsed[note.id]);
                return (
                  <li key={note.id}>
                    <div
                      className={`flex items-stretch ${
                        selectedId === note.id
                          ? "bg-indigo-50 text-indigo-900"
                          : "hover:bg-slate-50"
                      }`}
                      style={{ paddingLeft: 8 + depth * 14 }}
                    >
                      {hasKids ? (
                        <button
                          type="button"
                          aria-label={isCollapsed ? "展开" : "折叠"}
                          onClick={() =>
                            setCollapsed((prev) => ({
                              ...prev,
                              [note.id]: !prev[note.id],
                            }))
                          }
                          className="w-6 shrink-0 text-xs text-slate-400"
                        >
                          {isCollapsed ? "▸" : "▾"}
                        </button>
                      ) : (
                        <span className="w-6 shrink-0" />
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedId(note.id)}
                        className="min-w-0 flex-1 py-2 pr-2 text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-500">
                            {KIND_LABEL[note.kind]}
                          </span>
                          <span className="text-sm font-medium line-clamp-2">
                            {note.title}
                          </span>
                        </div>
                      </button>
                      {note.kind !== "point" ? (
                        <button
                          type="button"
                          title={
                            note.kind === "section" ? "加主题" : "加子知识"
                          }
                          onClick={() => startCreateUnder(note)}
                          className="shrink-0 px-2 text-sm text-indigo-600 hover:bg-indigo-100"
                        >
                          +
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {selected ? (
          <LearningNoteEditor
            key={selected.id}
            note={selected}
            notes={notes}
            projectId={projectId}
            projectSlug={projectSlug}
            attachments={selectedAttachments}
            requirements={requirements}
            competitorOptions={competitorOptions}
            bugOptions={bugOptions}
            reqById={reqById}
            pending={pending}
            onSave={saveSelected}
            onDelete={removeSelected}
            onLinkRequirement={linkRequirement}
            onUnlinkRequirement={unlinkRequirement}
            onLinkCompetitor={(id) =>
              setNoteLinks("linkedCompetitorIds", [
                ...(selected.linked_competitor_ids ?? []),
                id,
              ])
            }
            onUnlinkCompetitor={(id) =>
              setNoteLinks(
                "linkedCompetitorIds",
                (selected.linked_competitor_ids ?? []).filter((x) => x !== id)
              )
            }
            onLinkBug={(id) =>
              setNoteLinks("linkedBugIds", [
                ...(selected.linked_bug_ids ?? []),
                id,
              ])
            }
            onUnlinkBug={(id) =>
              setNoteLinks(
                "linkedBugIds",
                (selected.linked_bug_ids ?? []).filter((x) => x !== id)
              )
            }
            onAddSuggestion={addSuggestion}
            onPatchSuggestion={patchSuggestion}
            onGenerateRequirement={generateFromSuggestion}
            onAddChild={() => startCreateUnder(selected)}
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

function bySort(a: ProjectLearningNote, b: ProjectLearningNote) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.title.localeCompare(b.title, "zh-CN");
}

function isDescendantOf(
  notes: ProjectLearningNote[],
  nodeId: string,
  ancestorId: string
): boolean {
  const byId = new Map(notes.map((n) => [n.id, n]));
  let cur = byId.get(nodeId);
  while (cur?.parent_id) {
    if (cur.parent_id === ancestorId) return true;
    cur = byId.get(cur.parent_id);
  }
  return false;
}

function collectDescendantIdList(
  notes: ProjectLearningNote[],
  rootId: string
): string[] {
  const out: string[] = [];
  const byParent = new Map<string, ProjectLearningNote[]>();
  for (const n of notes) {
    if (!n.parent_id) continue;
    const list = byParent.get(n.parent_id) ?? [];
    list.push(n);
    byParent.set(n.parent_id, list);
  }
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const k of byParent.get(id) ?? []) {
      out.push(k.id);
      stack.push(k.id);
    }
  }
  return out;
}

function LearningNoteEditor({
  note,
  notes,
  projectId,
  projectSlug,
  attachments,
  requirements,
  competitorOptions,
  bugOptions,
  reqById,
  pending,
  onSave,
  onDelete,
  onLinkRequirement,
  onUnlinkRequirement,
  onLinkCompetitor,
  onUnlinkCompetitor,
  onLinkBug,
  onUnlinkBug,
  onAddSuggestion,
  onPatchSuggestion,
  onGenerateRequirement,
  onAddChild,
}: {
  note: ProjectLearningNote;
  notes: ProjectLearningNote[];
  projectId: string;
  projectSlug: string;
  attachments: LearningNoteAttachment[];
  requirements: LearningReqOption[];
  competitorOptions: CrossLinkOption[];
  bugOptions: CrossLinkOption[];
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
      parentId: string | null;
    }>
  ) => void;
  onDelete: () => void;
  onLinkRequirement: (requirementId: string) => void;
  onUnlinkRequirement: (requirementId: string) => void;
  onLinkCompetitor: (id: string) => void;
  onUnlinkCompetitor: (id: string) => void;
  onLinkBug: (id: string) => void;
  onUnlinkBug: (id: string) => void;
  onAddSuggestion: (title: string, detail: string) => void;
  onPatchSuggestion: (
    suggestionId: string,
    patch: { title?: string; detail?: string; remove?: boolean }
  ) => void;
  onGenerateRequirement: (suggestionId: string) => void;
  onAddChild: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [parentId, setParentId] = useState(note.parent_id ?? "");
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
  const [peek, setPeek] = useState<EntityPeekPayload | null>(null);
  const [peekPending, setPeekPending] = useState(false);

  const linkedIds = note.linked_requirement_ids ?? [];
  const suggestions = note.suggestions ?? [];
  const linkable = requirements.filter((r) => !linkedIds.includes(r.id));

  function openPeek(opt: CrossLinkOption) {
    setPeek({
      kind: opt.kind ?? "requirement",
      id: opt.id,
      title: opt.title,
      href: opt.href,
      badge: opt.badge,
      fields: (opt.fields ?? []).map((f, i) => ({
        key: f.key ?? `f${i}`,
        label: f.label,
        value: f.value,
        multiline: f.multiline,
      })),
    });
  }

  async function savePeek(patch: {
    title: string;
    fields: Record<string, string>;
  }) {
    if (!peek) return;
    setPeekPending(true);
    try {
      if (peek.kind === "competitor") {
        await updateCompetitorEntryAction({
          entryId: peek.id,
          projectSlug,
          title: patch.title,
          summary: patch.fields.summary,
          url: patch.fields.url || null,
        });
      } else if (peek.kind === "bug") {
        await updateBugAction({
          bugId: peek.id,
          projectSlug,
          updates: {
            title: patch.title,
            actualResult: patch.fields.actual || null,
            suggestion: patch.fields.suggestion || null,
          },
        });
      }
      setPeek(null);
    } finally {
      setPeekPending(false);
    }
  }

  const parentOptions =
    note.kind === "topic"
      ? notes.filter((n) => n.kind === "section")
      : note.kind === "point"
        ? notes.filter((n) => n.kind === "topic")
        : [];

  function saveAll() {
    onSave({
      title,
      whyText: draft.why_text,
      principle: draft.principle,
      protocol: draft.protocol,
      techBackground: draft.tech_background,
      competitors: draft.competitors,
      productThinking: draft.product_thinking,
      parentId:
        note.kind === "section"
          ? null
          : parentId.trim()
            ? parentId
            : null,
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
            {KIND_LABEL[note.kind]}
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-lg font-semibold text-slate-900 outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {note.kind !== "point" ? (
            <button
              type="button"
              disabled={pending}
              onClick={onAddChild}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
            >
              {note.kind === "section" ? "+ 主题" : "+ 子知识"}
            </button>
          ) : null}
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

      {note.kind !== "section" ? (
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-slate-500">
            {note.kind === "topic" ? "所属板块" : "所属主题"}
          </span>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">
              {note.kind === "topic" ? "未分板块" : "（请选择主题）"}
            </option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-xs text-slate-400">
          板块是容器：可在下方写总述，右侧树用「+ 主题」挂子项。
        </p>
      )}

      {FIELDS.map((field) => (
        <section key={field.key} className="space-y-1.5 border-t border-slate-100 pt-3">
          <h4 className="text-xs font-semibold text-slate-500">{field.label}</h4>
          <textarea
            value={draft[field.key]}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
            }
            rows={note.kind === "section" ? 2 : 3}
            placeholder={field.placeholder}
            className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
          />
        </section>
      ))}

      <LearningAttachmentsBlock
        key={note.id}
        projectId={projectId}
        noteId={note.id}
        attachments={attachments}
      />

      <section className="space-y-2 border-t border-slate-100 pt-3">
        <h4 className="text-xs font-semibold text-slate-500">关联需求</h4>
        {linkedIds.length === 0 ? (
          <p className="text-xs text-slate-400">
            尚未关联需求。可从下方选择已有需求，或先写优化建议再一键生成。
          </p>
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

      <CrossLinkSection
        title="关联竞品条目"
        linkedIds={note.linked_competitor_ids ?? []}
        options={competitorOptions}
        pending={pending}
        pickPlaceholder="选择竞品条目…"
        onLink={onLinkCompetitor}
        onUnlink={onUnlinkCompetitor}
        onOpen={openPeek}
      />
      <CrossLinkSection
        title="关联 Bug"
        linkedIds={note.linked_bug_ids ?? []}
        options={bugOptions}
        pending={pending}
        pickPlaceholder="选择 Bug…"
        onLink={onLinkBug}
        onUnlink={onUnlinkBug}
        onOpen={openPeek}
      />

      {peek ? (
        <EntitySidePeek
          item={peek}
          pending={peekPending}
          onClose={() => setPeek(null)}
          onSave={
            peek.kind === "competitor" || peek.kind === "bug"
              ? savePeek
              : undefined
          }
        />
      ) : null}

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
                onSave={(t, d) => onPatchSuggestion(s.id, { title: t, detail: d })}
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
