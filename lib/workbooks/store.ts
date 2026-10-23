import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readDb, writeDb } from "@/lib/db/local-store";
import type { ProjectWorkbook } from "@/lib/types";
import { createDefaultSheetData } from "@/lib/workbooks/default-sheet";

function uid(prefix: string) {
  return `${prefix}${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function asSheetData(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return createDefaultSheetData();
  return value.filter((x) => x && typeof x === "object") as Array<
    Record<string, unknown>
  >;
}

export function normalizeProjectWorkbook(
  row: Record<string, unknown>
): ProjectWorkbook {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    title: String(row.title ?? "未命名表格"),
    sheet_data: asSheetData(row.sheet_data),
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
  };
}

function tableMissing(message: string): boolean {
  return /project_workbooks|schema cache|does not exist|Could not find/i.test(
    message
  );
}

export async function listProjectWorkbooks(
  projectId: string
): Promise<ProjectWorkbook[]> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("project_workbooks")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return ((data ?? []) as Record<string, unknown>[]).map(
          normalizeProjectWorkbook
        );
      }
    }
  }
  const db = await readDb();
  return (db.project_workbooks ?? [])
    .filter((n) => n.project_id === projectId)
    .map((n) =>
      normalizeProjectWorkbook(n as unknown as Record<string, unknown>)
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getProjectWorkbook(
  workbookId: string
): Promise<ProjectWorkbook | null> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("project_workbooks")
        .select("*")
        .eq("id", workbookId)
        .maybeSingle();
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else if (data) {
        return normalizeProjectWorkbook(data as Record<string, unknown>);
      }
    }
  }
  const db = await readDb();
  const row = (db.project_workbooks ?? []).find((w) => w.id === workbookId);
  return row
    ? normalizeProjectWorkbook(row as unknown as Record<string, unknown>)
    : null;
}

export async function createProjectWorkbook(input: {
  project_id: string;
  title?: string;
  sheet_data?: Array<Record<string, unknown>>;
}): Promise<ProjectWorkbook> {
  const now = nowIso();
  const title = (input.title?.trim() || "未命名表格").slice(0, 120);
  const entry: ProjectWorkbook = {
    id: uid("wb-"),
    project_id: input.project_id,
    title,
    sheet_data: input.sheet_data?.length
      ? input.sheet_data
      : createDefaultSheetData(title),
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb.from("project_workbooks").insert(entry);
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return entry;
      }
    }
  }

  const db = await readDb();
  if (!db.project_workbooks) db.project_workbooks = [];
  db.project_workbooks.unshift(entry);
  await writeDb(db);
  return entry;
}

export async function updateProjectWorkbook(
  workbookId: string,
  patch: {
    title?: string;
    sheet_data?: Array<Record<string, unknown>>;
  }
): Promise<ProjectWorkbook> {
  const now = nowIso();

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data: existing, error: readErr } = await sb
        .from("project_workbooks")
        .select("*")
        .eq("id", workbookId)
        .maybeSingle();
      if (readErr) {
        if (!tableMissing(readErr.message)) throw new Error(readErr.message);
      } else if (existing) {
        const cur = normalizeProjectWorkbook(
          existing as Record<string, unknown>
        );
        const next: ProjectWorkbook = {
          ...cur,
          title:
            patch.title !== undefined
              ? patch.title.trim().slice(0, 120) || cur.title
              : cur.title,
          sheet_data:
            patch.sheet_data !== undefined
              ? asSheetData(patch.sheet_data)
              : cur.sheet_data,
          updated_at: now,
        };
        const { error } = await sb
          .from("project_workbooks")
          .update(next)
          .eq("id", workbookId);
        if (error) throw new Error(error.message);
        return next;
      }
    }
  }

  const db = await readDb();
  const idx = (db.project_workbooks ?? []).findIndex((e) => e.id === workbookId);
  if (idx < 0) throw new Error("工作簿不存在");
  const cur = normalizeProjectWorkbook(
    db.project_workbooks[idx] as unknown as Record<string, unknown>
  );
  const next: ProjectWorkbook = {
    ...cur,
    title:
      patch.title !== undefined
        ? patch.title.trim().slice(0, 120) || cur.title
        : cur.title,
    sheet_data:
      patch.sheet_data !== undefined
        ? asSheetData(patch.sheet_data)
        : cur.sheet_data,
    updated_at: now,
  };
  db.project_workbooks[idx] = next;
  await writeDb(db);
  return next;
}

export async function deleteProjectWorkbook(workbookId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb
        .from("project_workbooks")
        .delete()
        .eq("id", workbookId);
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
        else return;
      } else {
        return;
      }
    }
  }
  const db = await readDb();
  db.project_workbooks = (db.project_workbooks ?? []).filter(
    (e) => e.id !== workbookId
  );
  await writeDb(db);
}
