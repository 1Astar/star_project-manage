import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readDb, writeDb } from "@/lib/db/local-store";
import type {
  PrdDocVersion,
  PrdPrototypeLink,
  PrdReviewComment,
  ProjectPrd,
} from "@/lib/types";
import { nextPrdVersionLabel, normalizePrdVersions } from "@/lib/prds/versions";

function uid(prefix: string) {
  return `${prefix}${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function tableMissing(message: string): boolean {
  return /project_prds|prd_review_comments|schema cache|does not exist|Could not find/i.test(
    message
  );
}

function versionsColumnMissing(message: string): boolean {
  return /versions/i.test(message) && /column|schema cache/i.test(message);
}

function normalizeLinks(raw: unknown): PrdPrototypeLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l) => {
    const row = l as Record<string, unknown>;
    return {
      prototype_id: String(row.prototype_id ?? ""),
      note: String(row.note ?? ""),
      section_hint: String(row.section_hint ?? ""),
    };
  });
}

function normalizePrd(row: Record<string, unknown>): ProjectPrd {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    title: String(row.title ?? ""),
    module_path: row.module_path != null ? String(row.module_path) : null,
    html_content: String(row.html_content ?? ""),
    share_token: row.share_token != null ? String(row.share_token) : null,
    linked_prototypes: normalizeLinks(row.linked_prototypes),
    versions: normalizePrdVersions(row.versions),
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
  };
}

function normalizeComment(row: Record<string, unknown>): PrdReviewComment {
  return {
    id: String(row.id),
    prd_id: String(row.prd_id),
    project_id: String(row.project_id),
    anchor_text: String(row.anchor_text ?? ""),
    anchor_selector:
      row.anchor_selector != null ? String(row.anchor_selector) : null,
    body: String(row.body ?? ""),
    author: String(row.author ?? ""),
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
  };
}

const DEFAULT_HTML = `<h1>未命名 PRD</h1>
<p class="meta">在此编写产品需求</p>
<h2>1. 背景</h2>
<p></p>
<h2>2. 目标</h2>
<p></p>
<h2>3. 核心功能</h2>
<p></p>
`;

export async function listProjectPrds(projectId: string): Promise<ProjectPrd[]> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("project_prds")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return ((data ?? []) as Record<string, unknown>[]).map(normalizePrd);
      }
    }
  }
  const db = await readDb();
  return (db.project_prds ?? [])
    .filter((p) => p.project_id === projectId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getPrdById(prdId: string): Promise<ProjectPrd | null> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("project_prds")
        .select("*")
        .eq("id", prdId)
        .maybeSingle();
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else if (data) {
        return normalizePrd(data as Record<string, unknown>);
      } else {
        return null;
      }
    }
  }
  const db = await readDb();
  return (db.project_prds ?? []).find((p) => p.id === prdId) ?? null;
}

export async function getPrdByShareToken(
  token: string
): Promise<ProjectPrd | null> {
  const t = token.trim();
  if (!t) return null;
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("project_prds")
        .select("*")
        .eq("share_token", t)
        .maybeSingle();
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else if (data) {
        return normalizePrd(data as Record<string, unknown>);
      } else {
        return null;
      }
    }
  }
  const db = await readDb();
  return (db.project_prds ?? []).find((p) => p.share_token === t) ?? null;
}

export async function createProjectPrd(input: {
  project_id: string;
  title: string;
  module_path?: string | null;
  html_content?: string;
}): Promise<ProjectPrd> {
  const now = nowIso();
  const html = input.html_content?.trim() || DEFAULT_HTML;
  const prd: ProjectPrd = {
    id: uid("prd-"),
    project_id: input.project_id,
    title: input.title.trim() || "未命名 PRD",
    module_path: input.module_path?.trim() || null,
    html_content: html,
    share_token: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
    linked_prototypes: [],
    versions: [
      {
        id: uid("prdv-"),
        label: "1.0",
        html_content: html,
        created_at: now,
      },
    ],
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      let { error } = await sb.from("project_prds").insert(prd);
      if (error && versionsColumnMissing(error.message)) {
        const { versions: _versions, ...withoutVersions } = prd;
        ({ error } = await sb.from("project_prds").insert(withoutVersions));
      }
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return prd;
      }
    }
  }

  const db = await readDb();
  if (!db.project_prds) db.project_prds = [];
  db.project_prds.unshift(prd);
  await writeDb(db);
  return prd;
}

/** 每个项目都要有 PRD 节点：若尚无文档则建一篇默认稿 */
export async function ensureProjectHasPrd(input: {
  project_id: string;
  title?: string;
}): Promise<{ prds: ProjectPrd[]; created: boolean }> {
  const existing = await listProjectPrds(input.project_id);
  if (existing.length > 0) return { prds: existing, created: false };
  const created = await createProjectPrd({
    project_id: input.project_id,
    title: input.title?.trim() || "项目 PRD",
  });
  return { prds: [created], created: true };
}

export async function updateProjectPrd(
  prdId: string,
  patch: {
    title?: string;
    module_path?: string | null;
    html_content?: string;
    linked_prototypes?: PrdPrototypeLink[];
    versions?: PrdDocVersion[];
    rotate_share_token?: boolean;
    snapshot_version?: boolean;
  }
): Promise<ProjectPrd> {
  const existing = await getPrdById(prdId);
  if (!existing) throw new Error("PRD 不存在");

  const htmlContent =
    patch.html_content !== undefined ? patch.html_content : existing.html_content;
  let versions =
    patch.versions !== undefined ? patch.versions : existing.versions ?? [];
  if (patch.snapshot_version) {
    const now = nowIso();
    versions = [
      ...versions,
      {
        id: uid("prdv-"),
        label: nextPrdVersionLabel(versions),
        html_content: htmlContent,
        created_at: now,
      },
    ];
  }

  const next: ProjectPrd = {
    ...existing,
    title:
      patch.title !== undefined
        ? patch.title.trim() || existing.title
        : existing.title,
    module_path:
      patch.module_path !== undefined
        ? patch.module_path?.trim() || null
        : existing.module_path,
    html_content: htmlContent,
    linked_prototypes:
      patch.linked_prototypes !== undefined
        ? patch.linked_prototypes
        : existing.linked_prototypes,
    versions,
    share_token: patch.rotate_share_token
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 24)
      : existing.share_token ??
        crypto.randomUUID().replace(/-/g, "").slice(0, 24),
    updated_at: nowIso(),
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const payload = {
        title: next.title,
        module_path: next.module_path,
        html_content: next.html_content,
        linked_prototypes: next.linked_prototypes,
        versions: next.versions,
        share_token: next.share_token,
        updated_at: next.updated_at,
      };
      let { error } = await sb.from("project_prds").update(payload).eq("id", prdId);
      if (error && versionsColumnMissing(error.message)) {
        const { versions: _versions, ...withoutVersions } = payload;
        ({ error } = await sb
          .from("project_prds")
          .update(withoutVersions)
          .eq("id", prdId));
      }
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return next;
      }
    }
  }

  const db = await readDb();
  const idx = (db.project_prds ?? []).findIndex((p) => p.id === prdId);
  if (idx < 0) throw new Error("PRD 不存在");
  db.project_prds[idx] = next;
  await writeDb(db);
  return next;
}

export async function deleteProjectPrd(prdId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      await sb.from("prd_review_comments").delete().eq("prd_id", prdId);
      const { error } = await sb.from("project_prds").delete().eq("id", prdId);
      if (error && !tableMissing(error.message)) throw new Error(error.message);
      if (!error || !tableMissing(error.message)) return;
    }
  }
  const db = await readDb();
  db.project_prds = (db.project_prds ?? []).filter((p) => p.id !== prdId);
  db.prd_review_comments = (db.prd_review_comments ?? []).filter(
    (c) => c.prd_id !== prdId
  );
  await writeDb(db);
}

export async function listPrdComments(prdId: string): Promise<PrdReviewComment[]> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("prd_review_comments")
        .select("*")
        .eq("prd_id", prdId)
        .order("created_at", { ascending: true });
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return ((data ?? []) as Record<string, unknown>[]).map(normalizeComment);
      }
    }
  }
  const db = await readDb();
  return (db.prd_review_comments ?? [])
    .filter((c) => c.prd_id === prdId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function addPrdComment(input: {
  prd_id: string;
  project_id: string;
  body: string;
  author?: string;
  anchor_text?: string;
  anchor_selector?: string | null;
}): Promise<PrdReviewComment> {
  const body = input.body.trim();
  if (!body) throw new Error("评论不能为空");
  const now = nowIso();
  const comment: PrdReviewComment = {
    id: uid("prdc-"),
    prd_id: input.prd_id,
    project_id: input.project_id,
    anchor_text: input.anchor_text?.trim() ?? "",
    anchor_selector: input.anchor_selector ?? null,
    body,
    author: input.author?.trim() || "审阅者",
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb.from("prd_review_comments").insert(comment);
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return comment;
      }
    }
  }

  const db = await readDb();
  if (!db.prd_review_comments) db.prd_review_comments = [];
  db.prd_review_comments.push(comment);
  await writeDb(db);
  return comment;
}

export async function deletePrdComment(commentId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb
        .from("prd_review_comments")
        .delete()
        .eq("id", commentId);
      if (error && !tableMissing(error.message)) throw new Error(error.message);
      if (!error || !tableMissing(error.message)) return;
    }
  }
  const db = await readDb();
  db.prd_review_comments = (db.prd_review_comments ?? []).filter(
    (c) => c.id !== commentId
  );
  await writeDb(db);
}

export async function updatePrototypePrdLink(input: {
  prototype_id: string;
  prd_id: string | null;
  prd_note?: string | null;
}): Promise<void> {
  const db = await readDb();
  const proto = db.prototypes.find((p) => p.id === input.prototype_id);
  if (!proto) throw new Error("原型不存在");
  proto.prd_id = input.prd_id;
  proto.prd_note =
    input.prd_note !== undefined ? input.prd_note?.trim() || null : proto.prd_note;

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb
        .from("prototypes")
        .update({ prd_id: proto.prd_id, prd_note: proto.prd_note })
        .eq("id", input.prototype_id);
      if (error) {
        if (!/prd_id|prd_note|schema cache|column/i.test(error.message)) {
          throw new Error(error.message);
        }
      }
    }
  }
  await writeDb(db);
}
