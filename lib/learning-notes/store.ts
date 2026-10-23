import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readDb, writeDb } from "@/lib/db/local-store";
import type {
  LearningNoteAttachment,
  LearningNoteKind,
  LearningSuggestion,
  ProjectLearningNote,
} from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).filter(Boolean);
}

function asSuggestions(value: unknown): LearningSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const id = String(row.id ?? "").trim();
      const title = String(row.title ?? "").trim();
      if (!id || !title) return null;
      return {
        id,
        title,
        detail: String(row.detail ?? ""),
        linked_requirement_id:
          row.linked_requirement_id != null && String(row.linked_requirement_id).trim()
            ? String(row.linked_requirement_id)
            : null,
        created_at: String(row.created_at ?? nowIso()),
      } satisfies LearningSuggestion;
    })
    .filter((s): s is LearningSuggestion => Boolean(s));
}

function asKind(value: unknown): LearningNoteKind {
  const k = String(value ?? "").trim();
  if (k === "section" || k === "topic" || k === "point") return k;
  return "topic";
}

export function normalizeLearningNote(
  row: Record<string, unknown>
): ProjectLearningNote {
  const parentRaw = row.parent_id;
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    title: String(row.title ?? ""),
    kind: asKind(row.kind),
    parent_id:
      parentRaw != null && String(parentRaw).trim() ? String(parentRaw) : null,
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    why_text: String(row.why_text ?? ""),
    principle: String(row.principle ?? ""),
    protocol: String(row.protocol ?? ""),
    tech_background: String(row.tech_background ?? ""),
    competitors: String(row.competitors ?? ""),
    product_thinking: String(row.product_thinking ?? ""),
    linked_requirement_ids: asStringArray(row.linked_requirement_ids),
    linked_competitor_ids: asStringArray(row.linked_competitor_ids),
    linked_bug_ids: asStringArray(row.linked_bug_ids),
    suggestions: asSuggestions(row.suggestions),
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
  };
}

function normalizeNote(row: Record<string, unknown>): ProjectLearningNote {
  return normalizeLearningNote(row);
}

function tableMissing(message: string): boolean {
  return /project_learning_notes|learning_note_attachments|schema cache|does not exist|Could not find/i.test(
    message
  );
}

function attachmentTableMissing(message: string): boolean {
  return /learning_note_attachments|schema cache|does not exist|Could not find/i.test(
    message
  );
}

export function normalizeLearningAttachment(
  row: Record<string, unknown>
): LearningNoteAttachment {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    note_id: String(row.note_id),
    title: String(row.title ?? ""),
    url: String(row.url ?? ""),
    storage_path:
      row.storage_path != null && String(row.storage_path).trim()
        ? String(row.storage_path)
        : null,
    mime_type:
      row.mime_type != null && String(row.mime_type).trim()
        ? String(row.mime_type)
        : null,
    created_at: String(row.created_at ?? nowIso()),
  };
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

function sortNotes(a: ProjectLearningNote, b: ProjectLearningNote): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.title.localeCompare(b.title, "zh-CN");
}

export async function listProjectLearningNotes(
  projectId: string
): Promise<ProjectLearningNote[]> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("project_learning_notes")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false });
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return ((data ?? []) as Record<string, unknown>[])
          .map(normalizeNote)
          .sort(sortNotes);
      }
    }
  }
  const db = await readDb();
  return (db.project_learning_notes ?? [])
    .filter((n) => n.project_id === projectId)
    .map((n) => normalizeNote(n as unknown as Record<string, unknown>))
    .sort(sortNotes);
}

export async function getLearningNoteById(
  noteId: string
): Promise<ProjectLearningNote | null> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("project_learning_notes")
        .select("*")
        .eq("id", noteId)
        .maybeSingle();
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else if (data) {
        return normalizeNote(data as Record<string, unknown>);
      } else {
        return null;
      }
    }
  }
  const db = await readDb();
  const row = (db.project_learning_notes ?? []).find((n) => n.id === noteId);
  return row ? normalizeNote(row as unknown as Record<string, unknown>) : null;
}

async function nextSortOrder(
  projectId: string,
  parentId: string | null
): Promise<number> {
  const siblings = (await listProjectLearningNotes(projectId)).filter((n) =>
    parentId ? n.parent_id === parentId : n.parent_id == null
  );
  if (!siblings.length) return 0;
  return Math.max(...siblings.map((s) => s.sort_order)) + 1;
}

async function assertParentKind(
  projectId: string,
  kind: LearningNoteKind,
  parentId: string | null
): Promise<void> {
  if (kind === "section") {
    if (parentId) throw new Error("板块不能挂在其它节点下");
    return;
  }
  if (kind === "topic") {
    if (!parentId) return; // 允许「未分板块」下的主题
    const parent = await getLearningNoteById(parentId);
    if (!parent || parent.project_id !== projectId) {
      throw new Error("父板块不存在");
    }
    if (parent.kind !== "section") throw new Error("主题只能挂在板块下");
    return;
  }
  // point
  if (!parentId) throw new Error("子知识点必须挂在主题下");
  const parent = await getLearningNoteById(parentId);
  if (!parent || parent.project_id !== projectId) {
    throw new Error("父主题不存在");
  }
  if (parent.kind !== "topic") throw new Error("子知识点只能挂在主题下");
}

export async function createProjectLearningNote(input: {
  project_id: string;
  title: string;
  kind?: LearningNoteKind;
  parent_id?: string | null;
  sort_order?: number;
  why_text?: string;
  principle?: string;
  protocol?: string;
  tech_background?: string;
  competitors?: string;
  product_thinking?: string;
  linked_requirement_ids?: string[];
  linked_competitor_ids?: string[];
  linked_bug_ids?: string[];
  suggestions?: LearningSuggestion[];
}): Promise<ProjectLearningNote> {
  const kind = input.kind ?? "topic";
  const parent_id =
    kind === "section"
      ? null
      : input.parent_id != null && String(input.parent_id).trim()
        ? String(input.parent_id)
        : null;
  await assertParentKind(input.project_id, kind, parent_id);

  const now = nowIso();
  const sort_order =
    input.sort_order !== undefined
      ? input.sort_order
      : await nextSortOrder(input.project_id, parent_id);

  const note: ProjectLearningNote = {
    id: uid("ln-"),
    project_id: input.project_id,
    title: input.title.trim() || defaultTitle(kind),
    kind,
    parent_id,
    sort_order,
    why_text: input.why_text?.trim() ?? "",
    principle: input.principle?.trim() ?? "",
    protocol: input.protocol?.trim() ?? "",
    tech_background: input.tech_background?.trim() ?? "",
    competitors: input.competitors?.trim() ?? "",
    product_thinking: input.product_thinking?.trim() ?? "",
    linked_requirement_ids: uniqueIds(input.linked_requirement_ids ?? []),
    linked_competitor_ids: uniqueIds(input.linked_competitor_ids ?? []),
    linked_bug_ids: uniqueIds(input.linked_bug_ids ?? []),
    suggestions: asSuggestions(input.suggestions ?? []),
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb.from("project_learning_notes").insert(note);
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return note;
      }
    }
  }

  const db = await readDb();
  if (!db.project_learning_notes) db.project_learning_notes = [];
  db.project_learning_notes.unshift(note);
  await writeDb(db);
  return note;
}

function defaultTitle(kind: LearningNoteKind): string {
  if (kind === "section") return "未命名板块";
  if (kind === "point") return "未命名子知识";
  return "未命名主题";
}

export type LearningNotePatch = {
  title?: string;
  kind?: LearningNoteKind;
  parent_id?: string | null;
  sort_order?: number;
  why_text?: string;
  principle?: string;
  protocol?: string;
  tech_background?: string;
  competitors?: string;
  product_thinking?: string;
  linked_requirement_ids?: string[];
  linked_competitor_ids?: string[];
  linked_bug_ids?: string[];
  suggestions?: LearningSuggestion[];
};

export async function updateProjectLearningNote(
  noteId: string,
  patch: LearningNotePatch
): Promise<ProjectLearningNote> {
  const existing = await getLearningNoteById(noteId);
  if (!existing) throw new Error("学习笔记不存在");

  const kind = patch.kind ?? existing.kind;
  const parent_id =
    patch.parent_id !== undefined
      ? patch.parent_id != null && String(patch.parent_id).trim()
        ? String(patch.parent_id)
        : null
      : existing.parent_id;

  if (parent_id === noteId) throw new Error("不能挂到自己下面");
  await assertParentKind(existing.project_id, kind, parent_id);

  // 禁止把节点挂到自己的子孙下
  if (parent_id) {
    const all = await listProjectLearningNotes(existing.project_id);
    const descendantIds = collectDescendantIds(all, noteId);
    if (descendantIds.has(parent_id)) {
      throw new Error("不能挂到自己的下级节点下");
    }
  }

  const next: ProjectLearningNote = {
    ...existing,
    title:
      patch.title !== undefined ? patch.title.trim() || existing.title : existing.title,
    kind,
    parent_id: kind === "section" ? null : parent_id,
    sort_order:
      patch.sort_order !== undefined ? patch.sort_order : existing.sort_order,
    why_text: patch.why_text !== undefined ? patch.why_text : existing.why_text,
    principle: patch.principle !== undefined ? patch.principle : existing.principle,
    protocol: patch.protocol !== undefined ? patch.protocol : existing.protocol,
    tech_background:
      patch.tech_background !== undefined
        ? patch.tech_background
        : existing.tech_background,
    competitors:
      patch.competitors !== undefined ? patch.competitors : existing.competitors,
    product_thinking:
      patch.product_thinking !== undefined
        ? patch.product_thinking
        : existing.product_thinking,
    linked_requirement_ids:
      patch.linked_requirement_ids !== undefined
        ? uniqueIds(patch.linked_requirement_ids)
        : existing.linked_requirement_ids,
    linked_competitor_ids:
      patch.linked_competitor_ids !== undefined
        ? uniqueIds(patch.linked_competitor_ids)
        : existing.linked_competitor_ids,
    linked_bug_ids:
      patch.linked_bug_ids !== undefined
        ? uniqueIds(patch.linked_bug_ids)
        : existing.linked_bug_ids,
    suggestions:
      patch.suggestions !== undefined
        ? asSuggestions(patch.suggestions)
        : existing.suggestions,
    updated_at: nowIso(),
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb
        .from("project_learning_notes")
        .update({
          title: next.title,
          kind: next.kind,
          parent_id: next.parent_id,
          sort_order: next.sort_order,
          why_text: next.why_text,
          principle: next.principle,
          protocol: next.protocol,
          tech_background: next.tech_background,
          competitors: next.competitors,
          product_thinking: next.product_thinking,
          linked_requirement_ids: next.linked_requirement_ids,
          linked_competitor_ids: next.linked_competitor_ids,
          linked_bug_ids: next.linked_bug_ids,
          suggestions: next.suggestions,
          updated_at: next.updated_at,
        })
        .eq("id", noteId);
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return next;
      }
    }
  }

  const db = await readDb();
  const idx = (db.project_learning_notes ?? []).findIndex((n) => n.id === noteId);
  if (idx < 0) throw new Error("学习笔记不存在");
  db.project_learning_notes[idx] = next;
  await writeDb(db);
  return next;
}

function collectDescendantIds(
  all: ProjectLearningNote[],
  rootId: string
): Set<string> {
  const byParent = new Map<string | null, ProjectLearningNote[]>();
  for (const n of all) {
    const key = n.parent_id;
    const list = byParent.get(key) ?? [];
    list.push(n);
    byParent.set(key, list);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    const kids = byParent.get(id) ?? [];
    for (const k of kids) {
      if (out.has(k.id)) continue;
      out.add(k.id);
      stack.push(k.id);
    }
  }
  return out;
}

/** 删除节点及其全部子孙（含附件） */
export async function deleteProjectLearningNote(noteId: string): Promise<void> {
  const existing = await getLearningNoteById(noteId);
  if (!existing) return;
  const all = await listProjectLearningNotes(existing.project_id);
  const ids = [noteId, ...Array.from(collectDescendantIds(all, noteId))];

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error: attErr } = await sb
        .from("learning_note_attachments")
        .delete()
        .in("note_id", ids);
      if (attErr && !attachmentTableMissing(attErr.message)) {
        throw new Error(attErr.message);
      }
      const { error } = await sb.from("project_learning_notes").delete().in("id", ids);
      if (error && !tableMissing(error.message)) throw new Error(error.message);
      if (!error || !tableMissing(error.message)) return;
    }
  }
  const db = await readDb();
  const idSet = new Set(ids);
  db.project_learning_notes = (db.project_learning_notes ?? []).filter(
    (n) => !idSet.has(n.id)
  );
  db.learning_note_attachments = (db.learning_note_attachments ?? []).filter(
    (a) => !idSet.has(a.note_id)
  );
  await writeDb(db);
}

export async function listLearningAttachmentsForNote(
  noteId: string
): Promise<LearningNoteAttachment[]> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("learning_note_attachments")
        .select("*")
        .eq("note_id", noteId)
        .order("created_at", { ascending: false });
      if (error) {
        if (!attachmentTableMissing(error.message)) throw new Error(error.message);
      } else {
        return ((data ?? []) as Record<string, unknown>[]).map(
          normalizeLearningAttachment
        );
      }
    }
  }
  const db = await readDb();
  return (db.learning_note_attachments ?? [])
    .filter((a) => a.note_id === noteId)
    .map((a) => normalizeLearningAttachment(a as unknown as Record<string, unknown>))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listLearningAttachmentsForProject(
  projectId: string
): Promise<LearningNoteAttachment[]> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("learning_note_attachments")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) {
        if (!attachmentTableMissing(error.message)) throw new Error(error.message);
      } else {
        return ((data ?? []) as Record<string, unknown>[]).map(
          normalizeLearningAttachment
        );
      }
    }
  }
  const db = await readDb();
  return (db.learning_note_attachments ?? [])
    .filter((a) => a.project_id === projectId)
    .map((a) => normalizeLearningAttachment(a as unknown as Record<string, unknown>))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createLearningNoteAttachment(input: {
  project_id: string;
  note_id: string;
  title: string;
  url: string;
  storage_path?: string | null;
  mime_type?: string | null;
}): Promise<LearningNoteAttachment> {
  const note = await getLearningNoteById(input.note_id);
  if (!note || note.project_id !== input.project_id) {
    throw new Error("学习笔记不存在");
  }
  const attachment: LearningNoteAttachment = {
    id: uid("lna-"),
    project_id: input.project_id,
    note_id: input.note_id,
    title: input.title.trim() || "附件",
    url: input.url,
    storage_path: input.storage_path ?? null,
    mime_type: input.mime_type ?? null,
    created_at: nowIso(),
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb.from("learning_note_attachments").insert(attachment);
      if (error) {
        if (!attachmentTableMissing(error.message)) throw new Error(error.message);
      } else {
        return attachment;
      }
    }
  }

  const db = await readDb();
  if (!db.learning_note_attachments) db.learning_note_attachments = [];
  db.learning_note_attachments.unshift(attachment);
  await writeDb(db);
  return attachment;
}

export async function deleteLearningNoteAttachment(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb
        .from("learning_note_attachments")
        .delete()
        .eq("id", id);
      if (error && !attachmentTableMissing(error.message)) {
        throw new Error(error.message);
      }
      if (!error || !attachmentTableMissing(error.message)) return;
    }
  }
  const db = await readDb();
  const exists = (db.learning_note_attachments ?? []).some((a) => a.id === id);
  if (!exists) throw new Error("附件不存在");
  db.learning_note_attachments = (db.learning_note_attachments ?? []).filter(
    (a) => a.id !== id
  );
  await writeDb(db);
}

export function newLearningSuggestion(input: {
  title: string;
  detail?: string;
}): LearningSuggestion {
  return {
    id: uid("ls-"),
    title: input.title.trim() || "未命名建议",
    detail: input.detail?.trim() ?? "",
    linked_requirement_id: null,
    created_at: nowIso(),
  };
}

export function countDescendants(
  all: ProjectLearningNote[],
  rootId: string
): number {
  return collectDescendantIds(all, rootId).size;
}
