import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readDb, writeDb } from "@/lib/db/local-store";
import type { ProjectWikiPage, WikiPageHostKind } from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

const HOST_KINDS: WikiPageHostKind[] = [
  "module",
  "requirement",
  "bug",
  "learning",
  "prd",
  "competitor",
];

function asHostKind(value: unknown): WikiPageHostKind {
  const k = String(value ?? "").trim() as WikiPageHostKind;
  return HOST_KINDS.includes(k) ? k : "module";
}

export function normalizeWikiPage(row: Record<string, unknown>): ProjectWikiPage {
  const parentRaw = row.parent_id;
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    parent_id:
      parentRaw != null && String(parentRaw).trim() ? String(parentRaw) : null,
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
    host_kind: asHostKind(row.host_kind),
    host_key: String(row.host_key ?? "").trim(),
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
  };
}

function tableMissing(message: string): boolean {
  return /project_wiki_pages|schema cache|does not exist|Could not find/i.test(
    message
  );
}

function sortPages(a: ProjectWikiPage, b: ProjectWikiPage) {
  return (
    a.sort_order - b.sort_order ||
    a.title.localeCompare(b.title, "zh") ||
    a.created_at.localeCompare(b.created_at)
  );
}

export async function listProjectWikiPages(
  projectId: string
): Promise<ProjectWikiPage[]> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("project_wiki_pages")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return ((data ?? []) as Record<string, unknown>[])
          .map(normalizeWikiPage)
          .sort(sortPages);
      }
    }
  }
  const db = await readDb();
  return (db.project_wiki_pages ?? [])
    .filter((n) => n.project_id === projectId)
    .map((n) => normalizeWikiPage(n as unknown as Record<string, unknown>))
    .sort(sortPages);
}

export async function listWikiPagesByHost(input: {
  projectId: string;
  hostKind: WikiPageHostKind;
  hostKey: string;
  parentId?: string | null;
}): Promise<ProjectWikiPage[]> {
  const key = input.hostKey.trim();
  const parent =
    input.parentId === undefined
      ? undefined
      : input.parentId && String(input.parentId).trim()
        ? String(input.parentId)
        : null;
  const all = await listProjectWikiPages(input.projectId);
  return all.filter((p) => {
    if (p.host_kind !== input.hostKind) return false;
    if (p.host_key !== key) return false;
    if (parent === undefined) return true;
    return (p.parent_id ?? null) === parent;
  });
}

export async function getWikiPage(pageId: string): Promise<ProjectWikiPage | null> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("project_wiki_pages")
        .select("*")
        .eq("id", pageId)
        .maybeSingle();
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else if (data) {
        return normalizeWikiPage(data as Record<string, unknown>);
      } else {
        return null;
      }
    }
  }
  const db = await readDb();
  const row = (db.project_wiki_pages ?? []).find((p) => p.id === pageId);
  return row
    ? normalizeWikiPage(row as unknown as Record<string, unknown>)
    : null;
}

export async function createWikiPage(input: {
  project_id: string;
  title: string;
  body?: string;
  parent_id?: string | null;
  host_kind: WikiPageHostKind;
  host_key: string;
}): Promise<ProjectWikiPage> {
  const title = input.title.trim() || "无标题";
  const hostKey = input.host_key.trim();
  if (!hostKey) throw new Error("宿主不能为空");

  let hostKind = input.host_kind;
  let hostKeyFinal = hostKey;
  let parentId: string | null =
    input.parent_id && String(input.parent_id).trim()
      ? String(input.parent_id)
      : null;

  if (parentId) {
    const parent = await getWikiPage(parentId);
    if (!parent) throw new Error("父页面不存在");
    if (parent.project_id !== input.project_id) {
      throw new Error("父页面不属于本项目");
    }
    hostKind = parent.host_kind;
    hostKeyFinal = parent.host_key;
  }

  const siblings = await listWikiPagesByHost({
    projectId: input.project_id,
    hostKind,
    hostKey: hostKeyFinal,
    parentId,
  });

  const now = nowIso();
  const page: ProjectWikiPage = {
    id: uid("wiki-"),
    project_id: input.project_id,
    parent_id: parentId,
    title,
    body: input.body?.trim() ?? "",
    sort_order: siblings.length + 1,
    host_kind: hostKind,
    host_key: hostKeyFinal,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb.from("project_wiki_pages").insert(page);
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return page;
      }
    }
  }

  const db = await readDb();
  if (!db.project_wiki_pages) db.project_wiki_pages = [];
  db.project_wiki_pages.push(page);
  await writeDb(db);
  return page;
}

export type WikiPagePatch = {
  title?: string;
  body?: string;
  sort_order?: number;
  parent_id?: string | null;
};

export async function updateWikiPage(
  pageId: string,
  patch: WikiPagePatch
): Promise<ProjectWikiPage> {
  const existing = await getWikiPage(pageId);
  if (!existing) throw new Error("页面不存在");

  let parentId = existing.parent_id;
  if (patch.parent_id !== undefined) {
    parentId =
      patch.parent_id && String(patch.parent_id).trim()
        ? String(patch.parent_id)
        : null;
    if (parentId === pageId) throw new Error("不能挂到自己下面");
    if (parentId) {
      const parent = await getWikiPage(parentId);
      if (!parent) throw new Error("父页面不存在");
      if (parent.project_id !== existing.project_id) {
        throw new Error("父页面不属于本项目");
      }
      // 禁止挂到自己的子孙下
      let cur: ProjectWikiPage | null = parent;
      for (let i = 0; i < 64 && cur; i++) {
        if (cur.id === pageId) throw new Error("不能挂到自己的子树下");
        cur = cur.parent_id ? await getWikiPage(cur.parent_id) : null;
      }
    }
  }

  const next: ProjectWikiPage = {
    ...existing,
    title:
      patch.title !== undefined
        ? patch.title.trim() || "无标题"
        : existing.title,
    body: patch.body !== undefined ? patch.body : existing.body,
    sort_order:
      patch.sort_order !== undefined && Number.isFinite(Number(patch.sort_order))
        ? Number(patch.sort_order)
        : existing.sort_order,
    parent_id: parentId,
    host_kind: parentId
      ? ((await getWikiPage(parentId)) ?? existing).host_kind
      : existing.host_kind,
    host_key: parentId
      ? ((await getWikiPage(parentId)) ?? existing).host_key
      : existing.host_key,
    updated_at: nowIso(),
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb.from("project_wiki_pages").upsert(next);
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return next;
      }
    }
  }

  const db = await readDb();
  const idx = (db.project_wiki_pages ?? []).findIndex((p) => p.id === pageId);
  if (idx < 0) throw new Error("页面不存在");
  db.project_wiki_pages[idx] = next;
  await writeDb(db);
  return next;
}

export async function deleteWikiPage(pageId: string): Promise<void> {
  const root = await getWikiPage(pageId);
  if (!root) return;

  const all = await listProjectWikiPages(root.project_id);
  const toRemove = new Set<string>([pageId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of all) {
      if (p.parent_id && toRemove.has(p.parent_id) && !toRemove.has(p.id)) {
        toRemove.add(p.id);
        grew = true;
      }
    }
  }

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb
        .from("project_wiki_pages")
        .delete()
        .in("id", Array.from(toRemove));
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return;
      }
    }
  }

  const db = await readDb();
  db.project_wiki_pages = (db.project_wiki_pages ?? []).filter(
    (p) => !toRemove.has(p.id)
  );
  await writeDb(db);
}

/** 面包屑：从当前页向上到根 */
export async function getWikiPageAncestors(
  pageId: string
): Promise<ProjectWikiPage[]> {
  const chain: ProjectWikiPage[] = [];
  let cur = await getWikiPage(pageId);
  for (let i = 0; i < 64 && cur; i++) {
    chain.unshift(cur);
    cur = cur.parent_id ? await getWikiPage(cur.parent_id) : null;
  }
  return chain;
}
