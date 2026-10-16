import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readDb, writeDb } from "@/lib/db/local-store";
import type { ProjectLearningNote } from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeNote(row: Record<string, unknown>): ProjectLearningNote {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    title: String(row.title ?? ""),
    why_text: String(row.why_text ?? ""),
    principle: String(row.principle ?? ""),
    protocol: String(row.protocol ?? ""),
    tech_background: String(row.tech_background ?? ""),
    competitors: String(row.competitors ?? ""),
    product_thinking: String(row.product_thinking ?? ""),
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
  };
}

function tableMissing(message: string): boolean {
  return /project_learning_notes|schema cache|does not exist|Could not find/i.test(
    message
  );
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
        .order("updated_at", { ascending: false });
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return ((data ?? []) as Record<string, unknown>[]).map(normalizeNote);
      }
    }
  }
  const db = await readDb();
  return (db.project_learning_notes ?? [])
    .filter((n) => n.project_id === projectId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
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
  return (db.project_learning_notes ?? []).find((n) => n.id === noteId) ?? null;
}

export async function createProjectLearningNote(input: {
  project_id: string;
  title: string;
  why_text?: string;
  principle?: string;
  protocol?: string;
  tech_background?: string;
  competitors?: string;
  product_thinking?: string;
}): Promise<ProjectLearningNote> {
  const now = nowIso();
  const note: ProjectLearningNote = {
    id: uid("ln-"),
    project_id: input.project_id,
    title: input.title.trim() || "未命名笔记",
    why_text: input.why_text?.trim() ?? "",
    principle: input.principle?.trim() ?? "",
    protocol: input.protocol?.trim() ?? "",
    tech_background: input.tech_background?.trim() ?? "",
    competitors: input.competitors?.trim() ?? "",
    product_thinking: input.product_thinking?.trim() ?? "",
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

export async function updateProjectLearningNote(
  noteId: string,
  patch: {
    title?: string;
    why_text?: string;
    principle?: string;
    protocol?: string;
    tech_background?: string;
    competitors?: string;
    product_thinking?: string;
  }
): Promise<ProjectLearningNote> {
  const existing = await getLearningNoteById(noteId);
  if (!existing) throw new Error("学习笔记不存在");

  const next: ProjectLearningNote = {
    ...existing,
    title:
      patch.title !== undefined ? patch.title.trim() || existing.title : existing.title,
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
    updated_at: nowIso(),
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb
        .from("project_learning_notes")
        .update({
          title: next.title,
          why_text: next.why_text,
          principle: next.principle,
          protocol: next.protocol,
          tech_background: next.tech_background,
          competitors: next.competitors,
          product_thinking: next.product_thinking,
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

export async function deleteProjectLearningNote(noteId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb.from("project_learning_notes").delete().eq("id", noteId);
      if (error && !tableMissing(error.message)) throw new Error(error.message);
      if (!error || !tableMissing(error.message)) return;
    }
  }
  const db = await readDb();
  db.project_learning_notes = (db.project_learning_notes ?? []).filter(
    (n) => n.id !== noteId
  );
  await writeDb(db);
}
