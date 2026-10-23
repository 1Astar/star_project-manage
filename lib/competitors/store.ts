import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readDb, writeDb } from "@/lib/db/local-store";
import type { CompetitorEntry } from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((v) => String(v).trim()).filter(Boolean))
  );
}

export function normalizeCompetitorEntry(
  row: Record<string, unknown>
): CompetitorEntry {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    url:
      row.url != null && String(row.url).trim() ? String(row.url).trim() : null,
    module_path:
      row.module_path != null && String(row.module_path).trim()
        ? String(row.module_path).trim()
        : null,
    linked_learning_note_ids: asStringArray(row.linked_learning_note_ids),
    linked_requirement_ids: asStringArray(row.linked_requirement_ids),
    linked_bug_ids: asStringArray(row.linked_bug_ids),
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
  };
}

function tableMissing(message: string): boolean {
  return /competitor_entries|schema cache|does not exist|Could not find/i.test(
    message
  );
}

export async function listCompetitorEntries(
  projectId: string
): Promise<CompetitorEntry[]> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("competitor_entries")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return ((data ?? []) as Record<string, unknown>[]).map(
          normalizeCompetitorEntry
        );
      }
    }
  }
  const db = await readDb();
  return (db.competitor_entries ?? [])
    .filter((n) => n.project_id === projectId)
    .map((n) => normalizeCompetitorEntry(n as unknown as Record<string, unknown>))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function createCompetitorEntry(input: {
  project_id: string;
  title: string;
  summary?: string;
  url?: string | null;
  module_path?: string | null;
  linked_learning_note_ids?: string[];
  linked_requirement_ids?: string[];
  linked_bug_ids?: string[];
}): Promise<CompetitorEntry> {
  const now = nowIso();
  const entry: CompetitorEntry = {
    id: uid("ce-"),
    project_id: input.project_id,
    title: input.title.trim() || "未命名竞品",
    summary: input.summary?.trim() ?? "",
    url: input.url?.trim() || null,
    module_path: input.module_path?.trim() || null,
    linked_learning_note_ids: asStringArray(input.linked_learning_note_ids),
    linked_requirement_ids: asStringArray(input.linked_requirement_ids),
    linked_bug_ids: asStringArray(input.linked_bug_ids),
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb.from("competitor_entries").insert(entry);
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return entry;
      }
    }
  }

  const db = await readDb();
  if (!db.competitor_entries) db.competitor_entries = [];
  db.competitor_entries.unshift(entry);
  await writeDb(db);
  return entry;
}

export type CompetitorEntryPatch = {
  title?: string;
  summary?: string;
  url?: string | null;
  module_path?: string | null;
  linked_learning_note_ids?: string[];
  linked_requirement_ids?: string[];
  linked_bug_ids?: string[];
};

export async function updateCompetitorEntry(
  entryId: string,
  patch: CompetitorEntryPatch
): Promise<CompetitorEntry> {
  const now = nowIso();

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data: existing, error: readErr } = await sb
        .from("competitor_entries")
        .select("*")
        .eq("id", entryId)
        .maybeSingle();
      if (readErr) {
        if (!tableMissing(readErr.message)) throw new Error(readErr.message);
      } else if (existing) {
        const cur = normalizeCompetitorEntry(existing as Record<string, unknown>);
        const next: CompetitorEntry = {
          ...cur,
          title:
            patch.title !== undefined
              ? patch.title.trim() || cur.title
              : cur.title,
          summary:
            patch.summary !== undefined ? patch.summary.trim() : cur.summary,
          url:
            patch.url !== undefined
              ? patch.url?.trim() || null
              : cur.url,
          module_path:
            patch.module_path !== undefined
              ? patch.module_path?.trim() || null
              : cur.module_path,
          linked_learning_note_ids:
            patch.linked_learning_note_ids !== undefined
              ? asStringArray(patch.linked_learning_note_ids)
              : cur.linked_learning_note_ids,
          linked_requirement_ids:
            patch.linked_requirement_ids !== undefined
              ? asStringArray(patch.linked_requirement_ids)
              : cur.linked_requirement_ids,
          linked_bug_ids:
            patch.linked_bug_ids !== undefined
              ? asStringArray(patch.linked_bug_ids)
              : cur.linked_bug_ids,
          updated_at: now,
        };
        const { error } = await sb
          .from("competitor_entries")
          .update(next)
          .eq("id", entryId);
        if (error) throw new Error(error.message);
        return next;
      }
    }
  }

  const db = await readDb();
  const idx = (db.competitor_entries ?? []).findIndex((e) => e.id === entryId);
  if (idx < 0) throw new Error("竞品条目不存在");
  const cur = normalizeCompetitorEntry(
    db.competitor_entries[idx] as unknown as Record<string, unknown>
  );
  const next: CompetitorEntry = {
    ...cur,
    title:
      patch.title !== undefined ? patch.title.trim() || cur.title : cur.title,
    summary: patch.summary !== undefined ? patch.summary.trim() : cur.summary,
    url: patch.url !== undefined ? patch.url?.trim() || null : cur.url,
    module_path:
      patch.module_path !== undefined
        ? patch.module_path?.trim() || null
        : cur.module_path,
    linked_learning_note_ids:
      patch.linked_learning_note_ids !== undefined
        ? asStringArray(patch.linked_learning_note_ids)
        : cur.linked_learning_note_ids,
    linked_requirement_ids:
      patch.linked_requirement_ids !== undefined
        ? asStringArray(patch.linked_requirement_ids)
        : cur.linked_requirement_ids,
    linked_bug_ids:
      patch.linked_bug_ids !== undefined
        ? asStringArray(patch.linked_bug_ids)
        : cur.linked_bug_ids,
    updated_at: now,
  };
  db.competitor_entries[idx] = next;
  await writeDb(db);
  return next;
}

export async function deleteCompetitorEntry(entryId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb
        .from("competitor_entries")
        .delete()
        .eq("id", entryId);
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
        else return;
      } else {
        return;
      }
    }
  }
  const db = await readDb();
  db.competitor_entries = (db.competitor_entries ?? []).filter(
    (e) => e.id !== entryId
  );
  await writeDb(db);
}
