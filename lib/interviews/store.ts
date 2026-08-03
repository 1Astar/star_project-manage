import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readDb, writeDb } from "@/lib/db/local-store";
import type {
  InterviewHypothesis,
  InterviewHypothesisStatus,
  InterviewRequirementLink,
  ProjectInterview,
} from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeHypotheses(raw: unknown): InterviewHypothesis[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((h) => {
      const row = h as Record<string, unknown>;
      const status = String(row.status ?? "open") as InterviewHypothesisStatus;
      const ok =
        status === "open" ||
        status === "validating" ||
        status === "confirmed" ||
        status === "rejected";
      return {
        id: String(row.id ?? uid("ih-")),
        statement: String(row.statement ?? "").trim(),
        status: ok ? status : ("open" as const),
      };
    })
    .filter((h) => h.statement);
}

function normalizeInterview(row: Record<string, unknown>): ProjectInterview {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    title: String(row.title ?? ""),
    interviewee: row.interviewee != null ? String(row.interviewee) : null,
    interviewed_at: row.interviewed_at != null ? String(row.interviewed_at) : null,
    record_notes: String(row.record_notes ?? ""),
    product_judgment: String(row.product_judgment ?? ""),
    hypotheses: normalizeHypotheses(row.hypotheses),
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
  };
}

function tableMissing(message: string): boolean {
  return /project_interviews|interview_requirement_links|schema cache|does not exist|Could not find/i.test(
    message
  );
}

export async function listProjectInterviews(
  projectId: string
): Promise<ProjectInterview[]> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("project_interviews")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return ((data ?? []) as Record<string, unknown>[]).map(normalizeInterview);
      }
    }
  }
  const db = await readDb();
  return (db.project_interviews ?? [])
    .filter((i) => i.project_id === projectId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getInterviewById(
  interviewId: string
): Promise<ProjectInterview | null> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("project_interviews")
        .select("*")
        .eq("id", interviewId)
        .maybeSingle();
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else if (data) {
        return normalizeInterview(data as Record<string, unknown>);
      } else {
        return null;
      }
    }
  }
  const db = await readDb();
  return (db.project_interviews ?? []).find((i) => i.id === interviewId) ?? null;
}

export async function createProjectInterview(input: {
  project_id: string;
  title: string;
  interviewee?: string | null;
  interviewed_at?: string | null;
  record_notes?: string;
  product_judgment?: string;
  hypotheses?: InterviewHypothesis[];
  requirement_ids?: string[];
}): Promise<ProjectInterview> {
  const now = nowIso();
  const interview: ProjectInterview = {
    id: uid("iv-"),
    project_id: input.project_id,
    title: input.title.trim() || "未命名访谈",
    interviewee: input.interviewee?.trim() || null,
    interviewed_at: input.interviewed_at?.trim() || null,
    record_notes: input.record_notes?.trim() ?? "",
    product_judgment: input.product_judgment?.trim() ?? "",
    hypotheses: normalizeHypotheses(input.hypotheses ?? []),
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb.from("project_interviews").insert({
        ...interview,
        hypotheses: interview.hypotheses,
      });
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        for (const reqId of input.requirement_ids ?? []) {
          await linkInterviewRequirement({
            project_id: input.project_id,
            interview_id: interview.id,
            requirement_id: reqId,
          });
        }
        return interview;
      }
    }
  }

  const db = await readDb();
  if (!db.project_interviews) db.project_interviews = [];
  db.project_interviews.unshift(interview);
  for (const reqId of input.requirement_ids ?? []) {
    if (!db.interview_requirement_links) db.interview_requirement_links = [];
    db.interview_requirement_links.unshift({
      id: uid("irl-"),
      project_id: input.project_id,
      interview_id: interview.id,
      requirement_id: reqId,
      created_at: now,
    });
  }
  await writeDb(db);
  return interview;
}

export async function updateProjectInterview(
  interviewId: string,
  patch: {
    title?: string;
    interviewee?: string | null;
    interviewed_at?: string | null;
    record_notes?: string;
    product_judgment?: string;
    hypotheses?: InterviewHypothesis[];
  }
): Promise<ProjectInterview> {
  const existing = await getInterviewById(interviewId);
  if (!existing) throw new Error("访谈不存在");

  const next: ProjectInterview = {
    ...existing,
    title: patch.title !== undefined ? patch.title.trim() || existing.title : existing.title,
    interviewee:
      patch.interviewee !== undefined
        ? patch.interviewee?.trim() || null
        : existing.interviewee,
    interviewed_at:
      patch.interviewed_at !== undefined
        ? patch.interviewed_at?.trim() || null
        : existing.interviewed_at,
    record_notes:
      patch.record_notes !== undefined ? patch.record_notes : existing.record_notes,
    product_judgment:
      patch.product_judgment !== undefined
        ? patch.product_judgment
        : existing.product_judgment,
    hypotheses:
      patch.hypotheses !== undefined
        ? normalizeHypotheses(patch.hypotheses)
        : existing.hypotheses,
    updated_at: nowIso(),
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb
        .from("project_interviews")
        .update({
          title: next.title,
          interviewee: next.interviewee,
          interviewed_at: next.interviewed_at,
          record_notes: next.record_notes,
          product_judgment: next.product_judgment,
          hypotheses: next.hypotheses,
          updated_at: next.updated_at,
        })
        .eq("id", interviewId);
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return next;
      }
    }
  }

  const db = await readDb();
  const idx = (db.project_interviews ?? []).findIndex((i) => i.id === interviewId);
  if (idx < 0) throw new Error("访谈不存在");
  db.project_interviews[idx] = next;
  await writeDb(db);
  return next;
}

export async function deleteProjectInterview(interviewId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      await sb.from("interview_requirement_links").delete().eq("interview_id", interviewId);
      const { error } = await sb.from("project_interviews").delete().eq("id", interviewId);
      if (error && !tableMissing(error.message)) throw new Error(error.message);
      if (!error || !tableMissing(error.message)) return;
    }
  }
  const db = await readDb();
  db.project_interviews = (db.project_interviews ?? []).filter((i) => i.id !== interviewId);
  db.interview_requirement_links = (db.interview_requirement_links ?? []).filter(
    (l) => l.interview_id !== interviewId
  );
  await writeDb(db);
}

export async function listInterviewLinks(opts: {
  interviewId?: string;
  requirementId?: string;
  projectId?: string;
}): Promise<InterviewRequirementLink[]> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      let q = sb.from("interview_requirement_links").select("*");
      if (opts.interviewId) q = q.eq("interview_id", opts.interviewId);
      if (opts.requirementId) q = q.eq("requirement_id", opts.requirementId);
      if (opts.projectId) q = q.eq("project_id", opts.projectId);
      const { data, error } = await q;
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return ((data ?? []) as InterviewRequirementLink[]).map((r) => ({
          id: String(r.id),
          project_id: String(r.project_id),
          interview_id: String(r.interview_id),
          requirement_id: String(r.requirement_id),
          created_at: String(r.created_at),
        }));
      }
    }
  }
  const db = await readDb();
  let rows = db.interview_requirement_links ?? [];
  if (opts.interviewId) rows = rows.filter((l) => l.interview_id === opts.interviewId);
  if (opts.requirementId) {
    rows = rows.filter((l) => l.requirement_id === opts.requirementId);
  }
  if (opts.projectId) rows = rows.filter((l) => l.project_id === opts.projectId);
  return rows;
}

export async function linkInterviewRequirement(input: {
  project_id: string;
  interview_id: string;
  requirement_id: string;
}): Promise<InterviewRequirementLink> {
  const existing = await listInterviewLinks({
    interviewId: input.interview_id,
    requirementId: input.requirement_id,
  });
  if (existing[0]) return existing[0];

  const link: InterviewRequirementLink = {
    id: uid("irl-"),
    project_id: input.project_id,
    interview_id: input.interview_id,
    requirement_id: input.requirement_id,
    created_at: nowIso(),
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb.from("interview_requirement_links").insert(link);
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return link;
      }
    }
  }

  const db = await readDb();
  if (!db.interview_requirement_links) db.interview_requirement_links = [];
  db.interview_requirement_links.unshift(link);
  await writeDb(db);
  return link;
}

export async function unlinkInterviewRequirement(input: {
  interview_id: string;
  requirement_id: string;
}): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb
        .from("interview_requirement_links")
        .delete()
        .eq("interview_id", input.interview_id)
        .eq("requirement_id", input.requirement_id);
      if (error && !tableMissing(error.message)) throw new Error(error.message);
      if (!error || !tableMissing(error.message)) return;
    }
  }
  const db = await readDb();
  db.interview_requirement_links = (db.interview_requirement_links ?? []).filter(
    (l) =>
      !(
        l.interview_id === input.interview_id &&
        l.requirement_id === input.requirement_id
      )
  );
  await writeDb(db);
}

export async function listInterviewsForRequirement(
  requirementId: string
): Promise<ProjectInterview[]> {
  const links = await listInterviewLinks({ requirementId });
  const out: ProjectInterview[] = [];
  for (const link of links) {
    const iv = await getInterviewById(link.interview_id);
    if (iv) out.push(iv);
  }
  return out.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
