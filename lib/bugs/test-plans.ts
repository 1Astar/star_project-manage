import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { readDb, writeDb } from "@/lib/db/local-store";
import type { BugTestPlan, BugTestPlanStatus } from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizePlan(row: Record<string, unknown>): BugTestPlan {
  const statusRaw = String(row.status ?? "active");
  const status: BugTestPlanStatus =
    statusRaw === "archived" ? "archived" : "active";
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    title: String(row.title ?? "").trim() || "未命名测试计划",
    description: row.description != null ? String(row.description) : null,
    status,
    created_at: String(row.created_at ?? nowIso()),
    updated_at: String(row.updated_at ?? nowIso()),
  };
}

function tableMissing(message: string): boolean {
  return /bug_test_plans|schema cache|does not exist|Could not find/i.test(message);
}

export async function listBugTestPlans(
  projectId: string,
  opts?: { includeArchived?: boolean }
): Promise<BugTestPlan[]> {
  const includeArchived = Boolean(opts?.includeArchived);
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      let q = sb
        .from("bug_test_plans")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });
      if (!includeArchived) q = q.eq("status", "active");
      const { data, error } = await q;
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return ((data ?? []) as Record<string, unknown>[]).map(normalizePlan);
      }
    }
  }
  const db = await readDb();
  return (db.bug_test_plans ?? [])
    .filter((p) => p.project_id === projectId)
    .filter((p) => includeArchived || p.status === "active")
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getBugTestPlanById(
  planId: string
): Promise<BugTestPlan | null> {
  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { data, error } = await sb
        .from("bug_test_plans")
        .select("*")
        .eq("id", planId)
        .maybeSingle();
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else if (data) {
        return normalizePlan(data as Record<string, unknown>);
      } else {
        return null;
      }
    }
  }
  const db = await readDb();
  return (db.bug_test_plans ?? []).find((p) => p.id === planId) ?? null;
}

export async function createBugTestPlan(input: {
  project_id: string;
  title: string;
  description?: string | null;
}): Promise<BugTestPlan> {
  const now = nowIso();
  const plan: BugTestPlan = {
    id: uid("tp-"),
    project_id: input.project_id,
    title: input.title.trim() || "未命名测试计划",
    description: input.description?.trim() || null,
    status: "active",
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb.from("bug_test_plans").insert(plan);
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return plan;
      }
    }
  }

  const db = await readDb();
  if (!db.bug_test_plans) db.bug_test_plans = [];
  db.bug_test_plans.unshift(plan);
  await writeDb(db);
  return plan;
}

export async function updateBugTestPlan(
  planId: string,
  patch: {
    title?: string;
    description?: string | null;
    status?: BugTestPlanStatus;
  }
): Promise<BugTestPlan> {
  const existing = await getBugTestPlanById(planId);
  if (!existing) throw new Error("测试计划不存在");
  const next: BugTestPlan = {
    ...existing,
    title:
      patch.title !== undefined
        ? patch.title.trim() || existing.title
        : existing.title,
    description:
      patch.description !== undefined
        ? patch.description?.trim() || null
        : existing.description,
    status: patch.status ?? existing.status,
    updated_at: nowIso(),
  };

  if (isSupabaseConfigured()) {
    const sb = createServiceClient();
    if (sb) {
      const { error } = await sb.from("bug_test_plans").upsert(next, {
        onConflict: "id",
      });
      if (error) {
        if (!tableMissing(error.message)) throw new Error(error.message);
      } else {
        return next;
      }
    }
  }

  const db = await readDb();
  const idx = (db.bug_test_plans ?? []).findIndex((p) => p.id === planId);
  if (idx < 0) throw new Error("测试计划不存在");
  db.bug_test_plans![idx] = next;
  await writeDb(db);
  return next;
}
