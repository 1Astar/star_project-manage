import fs from "fs/promises";
import path from "path";
import { createSeedData } from "@/lib/db/seed-data";
import {
  readSupabaseDb,
  writeSupabaseDb,
  updateProjectById,
  upsertGitActivities,
  upsertIterationRow,
  upsertProjectRow,
  upsertRequirementRow,
  upsertRequirementAttachmentRow,
  upsertAcceptanceItemRow,
  deleteRequirementAttachmentRow,
  upsertActivityLogRow,
  upsertRequirementLinkRow,
  deleteRequirementLinkRow,
  deleteRequirementRows,
} from "@/lib/db/supabase-store";
import type { DatabaseSnapshot } from "@/lib/db/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { normalizeGithubRepoFullName } from "@/lib/github/client";
import {
  AGENT_ACTOR_NAME,
  encodeAgentActivityNote,
  formatAgentInspiration,
} from "@/lib/cursor-actor";
import { generateShareToken, hashToken } from "@/lib/utils";
import {
  canShareRoleComment,
  canShareRoleUpdateAcceptance,
  canShareRoleUpdateTask,
} from "@/lib/share-permissions";
import type {
  AcceptanceItem,
  AcceptanceRecord,
  ActivityLog,
  Bug,
  BugSeverity,
  BugType,
  GitActivity,
  Iteration,
  LinkEntityType,
  LinkRelationType,
  ModuleNode,
  PoolColumnDef,
  PoolColumnType,
  Project,
  ProjectMember,
  Prototype,
  Requirement,
  RequirementAttachment,
  RequirementComment,
  RequirementLink,
  RequirementType,
  RequirementUpdates,
  RoleTask,
  RoleType,
  ShareLink,
  TaskStatus,
  TestRecord,
} from "@/lib/types";
import {
  BUG_TYPE_LABELS,
  REQUIREMENT_CANCELLED_TAG,
  REQUIREMENT_POOL_DEFAULTS,
  deriveTaskStatusFromTags,
  requirementIsDone,
  statusTagsFromTaskStatus,
} from "@/lib/types";
import {
  defaultReqTypeForDepth,
  depthOf,
  deriveParentStatusTags,
  isLeafRequirement,
} from "@/lib/requirement-tree";

export type { DatabaseSnapshot } from "@/lib/db/types";

const SEED_FILE = path.join(process.cwd(), "data", "db.seed.json");

function getDataDir(): string {
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", "star-pm");
  }
  return path.join(process.cwd(), "data");
}

function getDbFile(): string {
  return path.join(getDataDir(), "db.json");
}

let memoryDb: DatabaseSnapshot | null = null;

function uid(_prefix = ""): string {
  // PM 表主键在 Supabase 为 uuid，不能带前缀（如 req-/iter-），否则 upsert 直接炸掉
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

async function readSeedFile(): Promise<DatabaseSnapshot | null> {
  try {
    const raw = await fs.readFile(SEED_FILE, "utf8");
    return JSON.parse(raw) as DatabaseSnapshot;
  } catch {
    return null;
  }
}

function isValidDb(db: DatabaseSnapshot | null | undefined): db is DatabaseSnapshot {
  return Boolean(db?.projects?.length && db.requirements?.length);
}

function normalizeRequirement(req: Requirement): Requirement {
  const tags =
    Array.isArray(req.status_tags) && req.status_tags.length > 0
      ? req.status_tags.map(String)
      : statusTagsFromTaskStatus(req.status ?? "pending");
  const typeRaw = (req as Requirement & { req_type?: string }).type
    ?? (req as Requirement & { req_type?: string }).req_type
    ?? "task";
  const type =
    typeRaw === "epic" || typeRaw === "feature" || typeRaw === "task" ? typeRaw : "task";
  return {
    ...REQUIREMENT_POOL_DEFAULTS,
    ...req,
    tags: req.tags ?? [],
    status_tags: tags,
    assignees: Array.isArray(req.assignees) ? req.assignees.map(String) : [],
    custom_fields: req.custom_fields ?? {},
    submitted_at:
      req.submitted_at ?? (req.created_at ? req.created_at.slice(0, 10) : null),
    completed_at: req.completed_at ?? null,
    studio_idea_id: req.studio_idea_id ?? null,
    parent_id: req.parent_id ?? null,
    type,
    direct_hours: req.direct_hours ?? null,
    actual_hours: req.actual_hours ?? null,
    force_closed: Boolean(req.force_closed),
  };
}

function normalizeBugRow(bug: Bug): Bug {
  const severityRaw = Number(bug.severity);
  const severity = ([1, 2, 3, 4].includes(severityRaw) ? severityRaw : 3) as BugSeverity;
  const typeRaw = String(bug.bug_type ?? "code");
  const bug_type = (typeRaw in BUG_TYPE_LABELS ? typeRaw : "code") as BugType;
  return {
    ...bug,
    requirement_id: bug.requirement_id ?? null,
    description: bug.description ?? null,
    repro_steps: bug.repro_steps ?? null,
    assignee: bug.assignee ?? null,
    severity,
    bug_type,
  };
}

function normalizeDb(db: DatabaseSnapshot): DatabaseSnapshot {
  return {
    ...db,
    comments: db.comments ?? [],
    git_activities: db.git_activities ?? [],
    project_members: db.project_members ?? [],
    activity_logs: db.activity_logs ?? [],
    pool_column_defs: (db.pool_column_defs ?? []).map((def) => ({
      ...def,
      options: Array.isArray(def.options) ? def.options : [],
    })),
    requirement_attachments: db.requirement_attachments ?? [],
    requirement_links: db.requirement_links ?? [],
    projects: db.projects.map(normalizeProject),
    requirements: db.requirements.map(normalizeRequirement),
    iterations: (db.iterations ?? []).map(normalizeIteration),
    bugs: (db.bugs ?? []).map(normalizeBugRow),
  };
}

function normalizeIteration(iter: Iteration): Iteration {
  return {
    ...iter,
    start_date: iter.start_date ?? null,
    end_date: iter.end_date ?? null,
    release_tag: iter.release_tag ?? null,
  };
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
    parent_id: project.parent_id ?? null,
    pool_tag_options: project.pool_tag_options?.length
      ? project.pool_tag_options
      : ["硬件", "软件", "体验"],
    repo_full_name: project.repo_full_name ?? null,
    repo_branch: project.repo_branch ?? null,
    repo_url: project.repo_url ?? null,
    last_commit_sha: project.last_commit_sha ?? null,
    last_commit_message: project.last_commit_message ?? null,
    last_commit_at: project.last_commit_at ?? null,
    last_git_synced_at: project.last_git_synced_at ?? null,
    vercel_project_id: project.vercel_project_id ?? null,
    vercel_deployment_url: project.vercel_deployment_url ?? null,
    last_deploy_status: project.last_deploy_status ?? null,
    demo_url: project.demo_url ?? null,
    local_run_guide: project.local_run_guide ?? null,
    code_path: project.code_path ?? null,
  };
}

async function readLocalDb(): Promise<DatabaseSnapshot> {
  if (isValidDb(memoryDb)) return memoryDb;

  if (process.env.VERCEL === "1" && !isSupabaseConfigured()) {
    const seeded = normalizeDb((await readSeedFile()) ?? createSeedData());
    memoryDb = seeded;
    return seeded;
  }

  const dbFile = getDbFile();
  const dataDir = getDataDir();

  try {
    await fs.mkdir(dataDir, { recursive: true });
    const raw = await fs.readFile(dbFile, "utf8");
    const parsed = normalizeDb(JSON.parse(raw) as DatabaseSnapshot);
    if (isValidDb(parsed)) {
      memoryDb = parsed;
      return memoryDb;
    }
  } catch {
    // fall through to seed
  }

  const seeded = normalizeDb((await readSeedFile()) ?? createSeedData());
  memoryDb = seeded;
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dbFile, JSON.stringify(seeded, null, 2), "utf8");
  } catch {
    // Vercel 等项目目录只读时，仅使用内存
  }
  return seeded;
}

async function saveLocalDb(db: DatabaseSnapshot): Promise<void> {
  memoryDb = db;
  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    await fs.writeFile(getDbFile(), JSON.stringify(db, null, 2), "utf8");
  } catch {
    // 写入失败时仍保留 memoryDb
  }
}

async function ensureDb(): Promise<DatabaseSnapshot> {
  if (isSupabaseConfigured()) {
    const db = normalizeDb(await readSupabaseDb());
    // Supabase 已有项目即视为真实数据，不再用 seed 覆盖
    if (db.projects.length > 0) {
      memoryDb = db;
      return db;
    }

    const seeded = normalizeDb((await readSeedFile()) ?? createSeedData());
    await writeSupabaseDb(seeded);
    memoryDb = seeded;
    return seeded;
  }
  return readLocalDb();
}

async function saveDb(db: DatabaseSnapshot): Promise<void> {
  if (isSupabaseConfigured()) {
    await writeSupabaseDb(db);
    return;
  }
  await saveLocalDb(db);
}


export async function updateProjectGitSettings(
  projectId: string,
  input: {
    repo_full_name?: string | null;
    repo_branch?: string | null;
    repo_url?: string | null;
    demo_url?: string | null;
    local_run_guide?: string | null;
    code_path?: string | null;
    vercel_project_id?: string | null;
    vercel_deployment_url?: string | null;
  }
): Promise<Project> {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!project) throw new Error("项目不存在");

  const repoFullNameRaw = input.repo_full_name?.trim() || null;
  const repoFullName = repoFullNameRaw
    ? normalizeGithubRepoFullName(repoFullNameRaw) || repoFullNameRaw
    : null;
  const repoBranch = input.repo_branch?.trim() || null;
  const fields: Partial<Project> = {
    repo_full_name: repoFullName,
    repo_branch: repoBranch,
    repo_url:
      input.repo_url?.trim() ||
      (repoFullName ? `https://github.com/${repoFullName}` : null),
    demo_url: input.demo_url?.trim() || null,
    local_run_guide: input.local_run_guide?.trim() || null,
    code_path: input.code_path?.trim() || null,
  };
  // 未填时不写 vercel_*，避免线上缺列（005 未跑）时整次 update 失败
  const vercelProjectId = input.vercel_project_id?.trim();
  if (vercelProjectId) fields.vercel_project_id = vercelProjectId;
  const vercelDeploymentUrl = input.vercel_deployment_url?.trim();
  if (vercelDeploymentUrl) fields.vercel_deployment_url = vercelDeploymentUrl;

  if (isSupabaseConfigured()) {
    const updated = await updateProjectById(project.id, fields);
    const idx = db.projects.findIndex((p) => p.id === project.id);
    db.projects[idx] = normalizeProject(updated);
    memoryDb = db;
    return db.projects[idx];
  }

  Object.assign(project, fields);
  await saveLocalDb(db);
  return project;
}

export async function persistGitSyncResult(
  projectId: string,
  projectFields: Partial<Project>,
  newActivities: GitActivity[]
) {
  if (isSupabaseConfigured()) {
    await updateProjectById(projectId, projectFields);
    await upsertGitActivities(newActivities);
    memoryDb = null;
    return;
  }

  const db = await readDb();
  const idx = db.projects.findIndex((p) => p.id === projectId);
  if (idx >= 0) {
    db.projects[idx] = normalizeProject({ ...db.projects[idx], ...projectFields });
  }
  db.git_activities = [...(db.git_activities ?? []), ...newActivities];
  await saveLocalDb(db);
}

export async function readDb(): Promise<DatabaseSnapshot> {
  return ensureDb();
}

export async function writeDb(db: DatabaseSnapshot): Promise<void> {
  await saveDb(db);
}

export type RequirementBoardItem = {
  requirement: Requirement;
  project_id: string;
  project_name: string;
  project_slug: string;
};

/** 跨项目需求看板：叶子需求 + 所属项目 */
export async function getAllRequirementsBoard(): Promise<{
  items: RequirementBoardItem[];
  projects: Array<{ id: string; name: string; slug: string }>;
}> {
  const db = await readDb();
  const projectMap = new Map(db.projects.map((p) => [p.id, p]));
  const byProject = new Map<string, Requirement[]>();
  for (const r of db.requirements) {
    const list = byProject.get(r.project_id) ?? [];
    list.push(r);
    byProject.set(r.project_id, list);
  }

  const items: RequirementBoardItem[] = [];
  for (const [projectId, reqs] of byProject) {
    const project = projectMap.get(projectId);
    if (!project) continue;
    for (const r of reqs) {
      if (!isLeafRequirement(r, reqs)) continue;
      items.push({
        requirement: r,
        project_id: project.id,
        project_name: project.name,
        project_slug: project.slug,
      });
    }
  }

  items.sort((a, b) => {
    const byProjectName = a.project_name.localeCompare(b.project_name, "zh");
    if (byProjectName) return byProjectName;
    return a.requirement.title.localeCompare(b.requirement.title, "zh");
  });

  const projects = db.projects
    .map((p: Project) => ({ id: p.id, name: p.name, slug: p.slug }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh"));

  return { items, projects };
}

export async function getProjects(): Promise<Project[]> {
  const db = await readDb();
  return db.projects;
}

export async function getProjectById(id: string): Promise<Project | null> {
  const db = await readDb();
  return db.projects.find((p) => p.id === id || p.slug === id) ?? null;
}

export async function getProjectBundle(projectId: string) {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!project) return null;

  const iterations = db.iterations.filter((i) => i.project_id === project.id);
  const iterationIds = new Set(iterations.map((i) => i.id));
  const modules = db.modules.filter((m) => iterationIds.has(m.iteration_id));
  const requirements = db.requirements.filter(
    (r) => r.project_id === project.id && !r.in_pool
  );
  const requirementIds = new Set(requirements.map((r) => r.id));
  const role_tasks = db.role_tasks.filter((t) => requirementIds.has(t.requirement_id));
  const acceptance_items = db.acceptance_items.filter((a) =>
    requirementIds.has(a.requirement_id)
  );
  const share_links = db.share_links.filter((l) => l.project_id === project.id);
  const notifications = db.notifications.filter((n) => n.project_id === project.id);
  const prototypes = db.prototypes.filter((p) => p.project_id === project.id);
  const bugs = db.bugs.filter((b) => b.project_id === project.id);
  const comments = (db.comments ?? []).filter((c) => c.project_id === project.id);
  const git_activities = (db.git_activities ?? [])
    .filter((a) => a.project_id === project.id)
    .sort((a, b) => b.committed_at.localeCompare(a.committed_at));
  const project_members = (db.project_members ?? []).filter(
    (m) => m.project_id === project.id
  );
  const pool_column_defs = (db.pool_column_defs ?? [])
    .filter((d) => d.project_id === project.id && d.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    project,
    iterations,
    modules,
    requirements,
    role_tasks,
    acceptance_items,
    share_links,
    notifications,
    prototypes,
    bugs,
    comments,
    git_activities,
    project_members,
    pool_column_defs,
    tagOptions: project.pool_tag_options?.length
      ? project.pool_tag_options
      : ["硬件", "软件", "体验"],
    activity_logs: (db.activity_logs ?? [])
      .filter((a) => a.project_id === project.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 30),
  };
}

export async function getShareLinkByToken(token: string) {
  const db = await readDb();
  const tokenHash = hashToken(token);
  const link = db.share_links.find(
    (l) => l.token_hash === tokenHash && l.is_active
  );
  if (!link) return null;
  const bundle = await getProjectBundle(link.project_id);
  return { link, bundle };
}

export async function logActivity(
  db: DatabaseSnapshot,
  entry: Omit<ActivityLog, "id" | "created_at">
): Promise<ActivityLog> {
  if (!db.activity_logs) db.activity_logs = [];
  const row: ActivityLog = {
    ...entry,
    id: uid("log-"),
    created_at: nowIso(),
  };
  db.activity_logs.unshift(row);
  return row;
}

async function persistActivityLog(log: ActivityLog) {
  if (isSupabaseConfigured()) {
    await upsertActivityLogRow(log);
  }
}

export async function updateRoleTask(
  taskId: string,
  updates: Partial<RoleTask>,
  actor: { name: string; role?: string }
) {
  const db = await readDb();
  const task = db.role_tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("任务不存在");

  const before = { ...task };
  Object.assign(task, updates, { updated_at: nowIso() });

  for (const [field, value] of Object.entries(updates)) {
    if (field === "updated_at") continue;
    const oldVal = String((before as Record<string, unknown>)[field] ?? "");
    const newVal = String(value ?? "");
    if (oldVal !== newVal) {
      const req = db.requirements.find((r) => r.id === task.requirement_id);
      await logActivity(db, {
        project_id: req?.project_id ?? "",
        entity_type: "role_task",
        entity_id: task.id,
        field_name: field,
        old_value: oldVal,
        new_value: newVal,
        actor_name: actor.name,
        actor_role: actor.role ?? null,
      });
    }
  }

  await saveDb(db);
  return task;
}

export async function updateAcceptanceItem(
  itemId: string,
  updates: Partial<AcceptanceItem>,
  actor: { name: string; role?: string }
) {
  const db = await readDb();
  const item = db.acceptance_items.find((a) => a.id === itemId);
  if (!item) throw new Error("验收项不存在");

  Object.assign(item, updates);
  const req = db.requirements.find((r) => r.id === item.requirement_id);

  if (req && updates.passed === false) {
    req.status = "in_progress";
    req.updated_at = nowIso();
  } else if (req && updates.passed === true) {
    const allItems = db.acceptance_items.filter((a) => a.requirement_id === req.id);
    if (allItems.every((a) => a.passed === true)) {
      req.status = "done";
      req.updated_at = nowIso();
    }
  }

  db.acceptance_records.unshift({
    id: uid("arec-"),
    requirement_id: item.requirement_id,
    acceptance_item_id: item.id,
    passed: updates.passed ?? false,
    note: updates.note ?? null,
    reviewer_name: actor.name,
    created_at: nowIso(),
  });

  await logActivity(db, {
    project_id: req?.project_id ?? "",
    entity_type: "acceptance_item",
    entity_id: item.id,
    field_name: "passed",
    old_value: String(item.passed),
    new_value: String(updates.passed),
    actor_name: actor.name,
    actor_role: actor.role ?? "admin",
  });

  await saveDb(db);
  return item;
}

export async function updateRequirement(
  requirementId: string,
  updates: RequirementUpdates,
  actor: { name: string; role?: string }
) {
  const db = await readDb();
  const req = db.requirements.find((r) => r.id === requirementId);
  if (!req) throw new Error("需求不存在");

  const before = { ...req };
  const { custom_fields, status_tags, force_closed, ...rest } = updates;

  // 有子需求时禁止手工标「完成」（除非强制关闭）
  if (status_tags && !updates.force_closed) {
    const hasChildren = db.requirements.some((r) => r.parent_id === req.id);
    const nextDone = requirementIsDone({
      status_tags,
      status: req.status,
    });
    if (hasChildren && nextDone && !req.force_closed) {
      const kids = db.requirements.filter((r) => r.parent_id === req.id);
      const allDone = kids.every((k) => requirementIsDone(k));
      if (!allDone) {
        throw new Error("存在未完成的子需求，不能将父需求标为完成；可使用「强制关闭」");
      }
    }
  }

  Object.assign(req, rest, { updated_at: nowIso() });
  if (custom_fields) {
    req.custom_fields = { ...req.custom_fields, ...custom_fields };
  }
  if (force_closed != null) {
    req.force_closed = force_closed;
    if (force_closed) {
      req.status_tags = [REQUIREMENT_CANCELLED_TAG];
      req.status = "blocked";
      req.completed_at = null;
    }
  }
  if (status_tags && force_closed == null) {
    req.status_tags = status_tags.map((t) => t.trim()).filter(Boolean);
    req.status = deriveTaskStatusFromTags(req.status_tags);
    const done = requirementIsDone(req);
    if (done) {
      if (!req.completed_at) req.completed_at = nowIso();
    } else {
      req.completed_at = null;
    }
  } else if (updates.status && (!req.status_tags || req.status_tags.length === 0)) {
    req.status_tags = statusTagsFromTaskStatus(updates.status);
  }
  if (updates.assignees) {
    req.assignees = updates.assignees.map((a) => a.trim()).filter(Boolean);
  }

  for (const [field, value] of Object.entries({
    ...rest,
    ...(status_tags ? { status_tags: req.status_tags } : {}),
    ...(updates.assignees ? { assignees: req.assignees } : {}),
    ...(custom_fields ? { custom_fields } : {}),
    ...(force_closed != null ? { force_closed: req.force_closed } : {}),
  })) {
    const oldVal =
      field === "custom_fields"
        ? JSON.stringify(before.custom_fields ?? {})
        : field === "status_tags" || field === "assignees" || field === "tags"
          ? JSON.stringify((before as Record<string, unknown>)[field] ?? [])
          : String((before as Record<string, unknown>)[field] ?? "");
    const newVal =
      field === "custom_fields"
        ? JSON.stringify(req.custom_fields ?? {})
        : field === "status_tags" || field === "assignees" || field === "tags"
          ? JSON.stringify(value ?? [])
          : String(value ?? "");
    if (oldVal !== newVal) {
      await logActivity(db, {
        project_id: req.project_id,
        entity_type: "requirement",
        entity_id: req.id,
        field_name: field,
        old_value: oldVal,
        new_value: newVal,
        actor_name: actor.name,
        actor_role: actor.role ?? "admin",
      });
    }
  }

  // 沿祖先链重算父状态
  await reconcileAncestorStatuses(db, req.parent_id);

  await saveDb(db);
  return req;
}

async function reconcileAncestorStatuses(
  db: DatabaseSnapshot,
  startParentId: string | null
) {
  let parentId = startParentId;
  const touched: Requirement[] = [];
  while (parentId) {
    const parent = db.requirements.find((r) => r.id === parentId);
    if (!parent) break;
    const nextTags = deriveParentStatusTags(parent, db.requirements);
    if (nextTags) {
      parent.status_tags = nextTags;
      parent.status = deriveTaskStatusFromTags(nextTags);
      const done = requirementIsDone(parent);
      parent.completed_at = done ? parent.completed_at ?? nowIso() : null;
      parent.updated_at = nowIso();
      touched.push(parent);
    }
    parentId = parent.parent_id;
  }
  if (isSupabaseConfigured() && touched.length) {
    for (const r of touched) {
      await upsertRequirementRow(r);
    }
  }
}

export async function addTestRecord(input: {
  requirement_id: string;
  role_task_id?: string | null;
  passed: boolean;
  issue_description?: string | null;
  tester_name: string;
}) {
  const db = await readDb();
  const req = db.requirements.find((r) => r.id === input.requirement_id);
  if (!req) throw new Error("需求不存在");

  const record: TestRecord = {
    id: uid("test-"),
    requirement_id: input.requirement_id,
    role_task_id: input.role_task_id ?? null,
    passed: input.passed,
    issue_description: input.issue_description ?? null,
    tester_name: input.tester_name,
    created_at: nowIso(),
  };
  db.test_records.unshift(record);

  if (!input.passed) {
    if (input.role_task_id) {
      const task = db.role_tasks.find((t) => t.id === input.role_task_id);
      if (task) {
        task.status = "in_progress";
        task.blocker_reason = input.issue_description ?? "测试不通过";
        task.updated_at = nowIso();
      }
    }
    req.status = "in_progress";
    req.updated_at = nowIso();

    db.notifications.unshift({
      id: uid("notif-"),
      project_id: req.project_id,
      recipient_name: null,
      type: "test_failed",
      title: `测试不通过：${req.title}`,
      body: input.issue_description ?? "请查看测试记录",
      link: `/projects/${req.project_id}/requirements/${req.id}`,
      is_read: false,
      created_at: nowIso(),
    });
  } else {
    req.status = "acceptance";
    req.updated_at = nowIso();
    db.notifications.unshift({
      id: uid("notif-"),
      project_id: req.project_id,
      recipient_name: "产品",
      type: "acceptance_pending",
      title: `待验收：${req.title}`,
      body: "测试已通过，等待产品验收",
      link: `/projects/${req.project_id}/requirements/${req.id}`,
      is_read: false,
      created_at: nowIso(),
    });
  }

  await saveDb(db);
  return record;
}

export async function addTestRecordWithPermission(
  input: {
    requirement_id: string;
    role_task_id?: string | null;
    passed: boolean;
    issue_description?: string | null;
    tester_name: string;
  },
  shareToken?: string
) {
  if (shareToken) {
    const linkData = await getShareLinkByToken(shareToken);
    if (!linkData?.bundle) throw new Error("无效或已停用的链接");
    const req = linkData.bundle.requirements.find((r) => r.id === input.requirement_id);
    if (!req) throw new Error("需求不存在");
    if (linkData.link.role !== "test" && linkData.link.role !== "admin") {
      throw new Error("无权提交测试");
    }
  }
  return addTestRecord(input);
}

export async function createShareLink(
  projectId: string,
  role: ShareLink["role"],
  label: string
) {
  const db = await readDb();
  const token = generateShareToken();
  const link: ShareLink & { plain_token: string } = {
    id: uid("link-"),
    project_id: projectId,
    role,
    label,
    token_hash: hashToken(token),
    is_active: true,
    created_at: nowIso(),
    plain_token: token,
  };
  db.share_links.push(link);
  await saveDb(db);
  return link;
}

export async function toggleShareLink(linkId: string, isActive: boolean) {
  const db = await readDb();
  const link = db.share_links.find((l) => l.id === linkId);
  if (!link) throw new Error("链接不存在");
  link.is_active = isActive;
  await saveDb(db);
  return link;
}

export async function getRequirementDetail(requirementId: string) {
  const db = await readDb();
  const requirement = db.requirements.find((r) => r.id === requirementId);
  if (!requirement) return null;
  const project = db.projects.find((p) => p.id === requirement.project_id);
  const iteration = db.iterations.find((i) => i.id === requirement.iteration_id) ?? null;
  const moduleL1 = requirement.module_l1_id
    ? db.modules.find((m) => m.id === requirement.module_l1_id) ?? null
    : null;
  const moduleL2 = requirement.module_l2_id
    ? db.modules.find((m) => m.id === requirement.module_l2_id) ?? null
    : null;
  return {
    project,
    requirement,
    iteration,
    moduleL1,
    moduleL2,
    role_tasks: db.role_tasks.filter((t) => t.requirement_id === requirementId),
    acceptance_items: db.acceptance_items.filter((a) => a.requirement_id === requirementId),
    test_records: db.test_records.filter((t) => t.requirement_id === requirementId),
    acceptance_records: db.acceptance_records.filter(
      (a) => a.requirement_id === requirementId
    ),
    bugs: db.bugs.filter((b) => b.requirement_id === requirementId),
    comments: (db.comments ?? []).filter((c) => c.requirement_id === requirementId),
    modules: db.modules.filter((m) => {
      const iter = db.iterations.find((i) => i.id === requirement.iteration_id);
      return iter !== undefined;
    }),
  };
}

export async function getBugById(bugId: string) {
  const db = await readDb();
  const bug = db.bugs.find((b) => b.id === bugId);
  if (!bug) return null;
  const project = db.projects.find((p) => p.id === bug.project_id);
  const requirement = bug.requirement_id
    ? db.requirements.find((r) => r.id === bug.requirement_id)
    : null;
  return { bug, project, requirement };
}

export async function createBug(input: {
  project_id: string;
  requirement_id?: string | null;
  title: string;
  description?: string;
  repro_steps?: string;
  assignee?: string;
  severity?: BugSeverity;
  bug_type?: BugType;
}) {
  const db = await readDb();
  const bug: Bug = {
    id: uid("bug-"),
    project_id: input.project_id,
    requirement_id: input.requirement_id ?? null,
    title: input.title,
    description: input.description ?? null,
    repro_steps: input.repro_steps ?? null,
    assignee: input.assignee ?? null,
    status: "pending",
    severity: input.severity ?? 3,
    bug_type: input.bug_type ?? "code",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.bugs.unshift(bug);
  db.notifications.unshift({
    id: uid("notif-"),
    project_id: input.project_id,
    recipient_name: input.assignee ?? null,
    type: "bug_created",
    title: `新 Bug：${input.title}`,
    body: input.description ?? null,
    link: `/projects/${input.project_id}/bugs/${bug.id}`,
    is_read: false,
    created_at: nowIso(),
  });
  await logActivity(db, {
    project_id: input.project_id,
    entity_type: "bug",
    entity_id: bug.id,
    field_name: "create",
    old_value: null,
    new_value: bug.title,
    actor_name: "产品",
    actor_role: "admin",
  });
  await saveDb(db);
  return bug;
}

export async function updateBug(
  bugId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    repro_steps: string | null;
    assignee: string | null;
    requirement_id: string | null;
    status: TaskStatus;
    severity: BugSeverity;
    bug_type: BugType;
  }>
) {
  const db = await readDb();
  const bug = db.bugs.find((b) => b.id === bugId);
  if (!bug) throw new Error("Bug 不存在");

  const beforeStatus = bug.status;
  if (patch.title !== undefined) bug.title = patch.title.trim() || bug.title;
  if (patch.description !== undefined) bug.description = patch.description;
  if (patch.repro_steps !== undefined) bug.repro_steps = patch.repro_steps;
  if (patch.assignee !== undefined) bug.assignee = patch.assignee;
  if (patch.requirement_id !== undefined) bug.requirement_id = patch.requirement_id;
  if (patch.status !== undefined) bug.status = patch.status;
  if (patch.severity !== undefined) bug.severity = patch.severity;
  if (patch.bug_type !== undefined) bug.bug_type = patch.bug_type;
  if (bug.severity == null) bug.severity = 3;
  if (!bug.bug_type) bug.bug_type = "code";
  bug.updated_at = nowIso();

  if (patch.status !== undefined && beforeStatus !== bug.status) {
    await logActivity(db, {
      project_id: bug.project_id,
      entity_type: "bug",
      entity_id: bug.id,
      field_name: "status",
      old_value: beforeStatus,
      new_value: bug.status,
      actor_name: "产品",
      actor_role: "admin",
    });
  }

  await saveDb(db);
  return bug;
}

export async function updateBugStatus(bugId: string, status: TaskStatus) {
  return updateBug(bugId, { status });
}

export async function listBugsByProject(projectId: string) {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!project) return [];
  return db.bugs
    .filter((b) => b.project_id === project.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listRequirementAttachments(requirementId: string) {
  const db = await readDb();
  return (db.requirement_attachments ?? [])
    .filter((a) => a.requirement_id === requirementId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listProjectAttachments(projectId: string) {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!project) return [];
  return (db.requirement_attachments ?? [])
    .filter((a) => a.project_id === project.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createRequirementAttachment(input: {
  project_id: string;
  requirement_id: string;
  title: string;
  url: string;
  storage_path?: string | null;
  mime_type?: string | null;
}) {
  const db = await readDb();
  const attachment: RequirementAttachment = {
    id: uid(),
    project_id: input.project_id,
    requirement_id: input.requirement_id,
    title: input.title.trim() || "附件",
    url: input.url,
    storage_path: input.storage_path ?? null,
    mime_type: input.mime_type ?? null,
    created_at: nowIso(),
  };

  if (!db.requirement_attachments) db.requirement_attachments = [];
  db.requirement_attachments.unshift(attachment);

  if (isSupabaseConfigured()) {
    await upsertRequirementAttachmentRow(attachment);
    memoryDb = db;
    return attachment;
  }

  await saveLocalDb(db);
  return attachment;
}

export async function deleteRequirementAttachment(id: string) {
  const db = await readDb();
  const exists = (db.requirement_attachments ?? []).some((a) => a.id === id);
  if (!exists) throw new Error("附件不存在");
  db.requirement_attachments = (db.requirement_attachments ?? []).filter((a) => a.id !== id);

  if (isSupabaseConfigured()) {
    await deleteRequirementAttachmentRow(id);
    memoryDb = db;
    return;
  }

  await saveLocalDb(db);
}

export async function addPrototype(input: {
  project_id: string;
  name: string;
  type: "html_zip" | "external_url";
  storage_path?: string | null;
  external_url?: string | null;
  requirement_id?: string | null;
}) {
  const db = await readDb();
  const proto: Prototype = {
    id: uid("proto-"),
    project_id: input.project_id,
    name: input.name,
    type: input.type,
    storage_path: input.storage_path ?? null,
    external_url: input.external_url ?? null,
    requirement_id: input.requirement_id ?? null,
    created_at: nowIso(),
  };
  db.prototypes.push(proto);
  await saveDb(db);
  return proto;
}

export async function getMyTodos(recipientName?: string) {
  const db = await readDb();
  const pendingTasks = db.role_tasks
    .filter((t) => t.status !== "done" && t.status !== "blocked")
    .map((t) => {
      const req = db.requirements.find((r) => r.id === t.requirement_id);
      const project = req
        ? db.projects.find((p) => p.id === req.project_id)
        : undefined;
      return {
        ...t,
        requirement_title: req?.title?.trim() || "未知需求",
        project_id: req?.project_id ?? "",
        project_name: project?.name?.trim() || "未知项目",
        project_slug: project?.slug || req?.project_id || "",
      };
    })
    // 待测试 / 待验收优先，方便产品一眼看到卡点
    .sort((a, b) => {
      const rank = (s: string) =>
        s === "testing" ? 0 : s === "acceptance" ? 1 : s === "integration" ? 2 : 3;
      return rank(a.status) - rank(b.status) || a.updated_at.localeCompare(b.updated_at);
    });
  const pendingAcceptance = db.requirements.filter((r) => r.status === "acceptance");
  const unreadNotifications = db.notifications.filter(
    (n) => !n.is_read && (!recipientName || n.recipient_name === recipientName || !n.recipient_name)
  );
  return { pendingTasks, pendingAcceptance, unreadNotifications };
}

export async function markNotificationRead(notificationId: string) {
  const db = await readDb();
  const n = db.notifications.find((x) => x.id === notificationId);
  if (n) n.is_read = true;
  await saveDb(db);
}

export async function runDeadlineReminders() {
  const db = await readDb();
  const today = new Date();
  const inTwoDays = new Date(today);
  inTwoDays.setDate(inTwoDays.getDate() + 2);
  const todayStr = today.toISOString().slice(0, 10);
  const soonStr = inTwoDays.toISOString().slice(0, 10);
  let created = 0;

  for (const task of db.role_tasks) {
    if (!task.end_date || task.status === "done") continue;
    if (task.end_date === todayStr || task.end_date === soonStr) {
      const req = db.requirements.find((r) => r.id === task.requirement_id);
      if (!req) continue;
      const exists = db.notifications.some(
        (n) =>
          n.type === "deadline_soon" &&
          n.body?.includes(task.id) &&
          n.created_at.slice(0, 10) === todayStr
      );
      if (exists) continue;
      db.notifications.unshift({
        id: uid("notif-"),
        project_id: req.project_id,
        recipient_name: task.assignee,
        type: "deadline_soon",
        title: `任务临近截止：${req.title}`,
        body: `task:${task.id} 截止 ${task.end_date}`,
        link: `/projects/${req.project_id}/requirements/${req.id}`,
        is_read: false,
        created_at: nowIso(),
      });
      created++;
    }
  }
  if (created > 0) await saveDb(db);
  return { created };
}

export {
  canShareRoleComment,
  canShareRoleUpdateAcceptance,
  canShareRoleUpdateTask,
} from "@/lib/share-permissions";

export async function updateAcceptanceItemWithPermission(
  itemId: string,
  updates: Partial<AcceptanceItem>,
  actor: { name: string; role?: string },
  shareToken?: string
) {
  if (shareToken) {
    const linkData = await getShareLinkByToken(shareToken);
    if (!linkData?.bundle) throw new Error("无效或已停用的链接");
    const item = linkData.bundle.acceptance_items.find((a) => a.id === itemId);
    if (!item) throw new Error("验收项不存在");
    if (!canShareRoleUpdateAcceptance(linkData.link.role)) {
      throw new Error("无权修改验收项");
    }
  }
  return updateAcceptanceItem(itemId, updates, actor);
}

export async function addRequirementComment(input: {
  project_id: string;
  requirement_id: string;
  author_name: string;
  author_role?: string | null;
  body: string;
  shareToken?: string;
}) {
  const body = input.body.trim();
  if (!body) throw new Error("评论不能为空");

  const db = await readDb();
  const requirement = db.requirements.find((r) => r.id === input.requirement_id);
  if (!requirement || requirement.project_id !== input.project_id) {
    throw new Error("需求不存在");
  }

  if (input.shareToken) {
    const linkData = await getShareLinkByToken(input.shareToken);
    if (!linkData || linkData.link.project_id !== input.project_id) {
      throw new Error("无效或已停用的链接");
    }
    if (!canShareRoleComment(linkData.link.role)) {
      throw new Error("无权评论");
    }
  }

  const comment = {
    id: uid("cmt-"),
    project_id: input.project_id,
    requirement_id: input.requirement_id,
    author_name: input.author_name,
    author_role: input.author_role ?? null,
    body,
    created_at: nowIso(),
  };

  if (!db.comments) db.comments = [];
  db.comments.unshift(comment);
  await saveDb(db);
  return comment;
}

export async function updateRoleTaskWithPermission(
  taskId: string,
  updates: Partial<RoleTask>,
  actor: { name: string; role?: string },
  shareToken?: string
) {
  if (shareToken) {
    const linkData = await getShareLinkByToken(shareToken);
    if (!linkData) throw new Error("无效或已停用的链接");
    const task = linkData.bundle?.role_tasks.find((t) => t.id === taskId);
    if (!task) throw new Error("任务不存在");
    if (!canShareRoleUpdateTask(linkData.link.role, task.role)) {
      throw new Error("无权修改此任务");
    }
  }
  return updateRoleTask(taskId, updates, actor);
}

const POOL_ITERATION_NAME = "需求池";

/** 为未硬编码映射的 Studio 项目创建/挂接 PM 需求池项目 */
export async function ensurePmProjectForStudio(input: {
  slug: string;
  name: string;
  description?: string | null;
  demo_url?: string | null;
  local_run_guide?: string | null;
  code_path?: string | null;
  repo_full_name?: string | null;
  repo_branch?: string | null;
  repo_url?: string | null;
}): Promise<Project> {
  const existing = await getProjectById(input.slug);
  if (existing) {
    await ensurePoolIteration(existing.id);
    return existing;
  }

  const project: Project = {
    id: uid(),
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    parent_id: null,
    pool_tag_options: ["硬件", "软件", "体验"],
    created_at: nowIso(),
    repo_full_name: input.repo_full_name ?? null,
    repo_branch: input.repo_branch ?? null,
    repo_url: input.repo_url ?? null,
    last_commit_sha: null,
    last_commit_message: null,
    last_commit_at: null,
    last_git_synced_at: null,
    vercel_project_id: null,
    vercel_deployment_url: null,
    last_deploy_status: null,
    demo_url: input.demo_url ?? null,
    local_run_guide: input.local_run_guide ?? null,
    code_path: input.code_path ?? null,
  };

  if (isSupabaseConfigured()) {
    await upsertProjectRow(project);
    if (memoryDb) {
      memoryDb.projects = [...memoryDb.projects, project];
    } else {
      const db = await readDb();
      db.projects.push(project);
      memoryDb = db;
    }
  } else {
    const db = await readDb();
    db.projects.push(project);
    await saveLocalDb(db);
  }

  await ensurePoolIteration(project.id);
  return project;
}

export async function ensurePoolIteration(projectId: string): Promise<Iteration> {
  const db = await readDb();
  let iteration = db.iterations.find(
    (i) => i.project_id === projectId && i.name === POOL_ITERATION_NAME
  );
  if (iteration) return iteration;

  iteration = {
    id: uid("iter-"),
    project_id: projectId,
    name: POOL_ITERATION_NAME,
    sort_order: -1,
    created_at: nowIso(),
    start_date: null,
    end_date: null,
    release_tag: null,
  };

  // 只插一条 iteration，禁止走 writeSupabaseDb 全量 upsert（缺列/脏字段会炸整页）
  if (isSupabaseConfigured()) {
    await upsertIterationRow(iteration);
    if (memoryDb) {
      memoryDb.iterations = [...memoryDb.iterations, iteration];
    } else {
      db.iterations.push(iteration);
      memoryDb = db;
    }
    return iteration;
  }

  db.iterations.push(iteration);
  await saveLocalDb(db);
  return iteration;
}

export async function createPlanningIteration(input: {
  projectId: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  release_tag?: string | null;
}): Promise<Iteration> {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === input.projectId || p.slug === input.projectId);
  if (!project) throw new Error("项目不存在");
  const name = input.name.trim();
  if (!name) throw new Error("迭代名称必填");
  if (name === POOL_ITERATION_NAME) throw new Error("名称保留给需求池");

  const siblings = db.iterations.filter(
    (i) => i.project_id === project.id && i.name !== POOL_ITERATION_NAME
  );
  const maxOrder = siblings.reduce((m, i) => Math.max(m, i.sort_order), 0);

  const iteration: Iteration = {
    id: uid("iter-"),
    project_id: project.id,
    name,
    sort_order: maxOrder + 1,
    created_at: nowIso(),
    start_date: input.start_date?.trim() || null,
    end_date: input.end_date?.trim() || null,
    release_tag: input.release_tag?.trim() || null,
  };

  if (isSupabaseConfigured()) {
    await upsertIterationRow(iteration);
    if (memoryDb) {
      memoryDb.iterations = [...memoryDb.iterations, iteration];
    } else {
      db.iterations.push(iteration);
      memoryDb = db;
    }
    return iteration;
  }

  db.iterations.push(iteration);
  await saveLocalDb(db);
  return iteration;
}

export async function updatePlanningIteration(
  iterationId: string,
  updates: Partial<{
    name: string;
    start_date: string | null;
    end_date: string | null;
    release_tag: string | null;
    sort_order: number;
  }>
): Promise<Iteration> {
  const db = await readDb();
  const iteration = db.iterations.find((i) => i.id === iterationId);
  if (!iteration) throw new Error("迭代不存在");
  if (iteration.name === POOL_ITERATION_NAME) throw new Error("不能编辑需求池迭代");

  if (updates.name !== undefined) {
    const name = updates.name.trim();
    if (!name) throw new Error("迭代名称必填");
    if (name === POOL_ITERATION_NAME) throw new Error("名称保留给需求池");
    iteration.name = name;
  }
  if (updates.start_date !== undefined) {
    iteration.start_date = updates.start_date?.trim() || null;
  }
  if (updates.end_date !== undefined) {
    iteration.end_date = updates.end_date?.trim() || null;
  }
  if (updates.release_tag !== undefined) {
    iteration.release_tag = updates.release_tag?.trim() || null;
  }
  if (updates.sort_order !== undefined) {
    iteration.sort_order = updates.sort_order;
  }

  if (isSupabaseConfigured()) {
    await upsertIterationRow(iteration);
    if (memoryDb) {
      const idx = memoryDb.iterations.findIndex((i) => i.id === iterationId);
      if (idx >= 0) memoryDb.iterations[idx] = iteration;
    }
    return iteration;
  }

  await saveLocalDb(db);
  return iteration;
}

export async function getPoolBundle(projectId: string) {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!project) return null;

  const poolIteration = await ensurePoolIteration(project.id);
  const poolRequirements = db.requirements
    .filter((r) => r.project_id === project.id && r.in_pool)
    .sort((a, b) => a.sort_order - b.sort_order);
  const poolModules = db.modules
    .filter((m) => m.iteration_id === poolIteration.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const activeIterations = db.iterations
    .filter((i) => i.project_id === project.id && i.name !== POOL_ITERATION_NAME)
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    project,
    poolIteration,
    poolRequirements,
    poolModules,
    activeIterations,
    project_members: (db.project_members ?? []).filter((m) => m.project_id === project.id),
    poolColumnDefs: (db.pool_column_defs ?? [])
      .filter((d) => d.project_id === project.id && d.is_active)
      .sort((a, b) => a.sort_order - b.sort_order),
    tagOptions: project.pool_tag_options?.length
      ? project.pool_tag_options
      : ["硬件", "软件", "体验"],
    attachments: (db.requirement_attachments ?? [])
      .filter((a) => a.project_id === project.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    links: (db.requirement_links ?? [])
      .filter((l) => l.project_id === project.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

export async function createPoolRequirement(
  projectId: string,
  input: Partial<
    Pick<
      Requirement,
      | "title"
      | "category"
      | "stage_type"
      | "priority"
      | "status"
      | "status_tags"
      | "assignees"
      | "detail_work"
      | "acceptance_criteria"
      | "req_source"
      | "inspiration_source"
      | "next_step"
      | "studio_idea_id"
      | "optimization_notes"
      | "known_issues"
      | "module_l1_id"
      | "sub_function"
      | "product_estimate_hours"
      | "direct_hours"
      | "actual_hours"
      | "submitted_at"
      | "completed_at"
      | "parent_id"
      | "type"
    >
  > & {
    /** 默认同步来自 Auto；勿再写「系统」 */
    actor_name?: string;
    /** 灰色小字：具体对话窗口/话题，便于回溯 */
    actor_note?: string;
  }
) {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!project) throw new Error("项目不存在");

  const poolIteration = await ensurePoolIteration(project.id);
  const siblings = db.requirements.filter(
    (r) =>
      r.project_id === project.id &&
      r.in_pool &&
      (r.parent_id ?? null) === (input.parent_id ?? null)
  );
  const sortOrder = siblings.length + 1;

  const statusTags = input.status_tags?.length
    ? input.status_tags
    : statusTagsFromTaskStatus(input.status ?? "pending");
  const done = requirementIsDone({ status_tags: statusTags, status: "pending" });

  const depth = (() => {
    if (!input.parent_id) return 0;
    const parent = db.requirements.find((r) => r.id === input.parent_id);
    if (!parent) return 1;
    return depthOf(parent, db.requirements) + 1;
  })();
  const reqType: RequirementType =
    input.type ?? defaultReqTypeForDepth(depth);

  const fromAgent =
    Boolean(input.studio_idea_id) ||
    input.actor_name === AGENT_ACTOR_NAME ||
    input.actor_name === "尘" ||
    input.actor_name === "Auto" ||
    input.actor_name === "Cursor";
  const actorNoteRaw =
    input.actor_note?.trim() ||
    input.inspiration_source?.trim() ||
    (fromAgent ? "对话入库" : null);
  const actorNote = actorNoteRaw?.replace(/^(白昼|星辰|尘|墨|Auto|Cursor)\s*·\s*/i, "").trim() || null;
  const inspiration = fromAgent
    ? formatAgentInspiration({
        windowNote: actorNote,
        triggerSource: input.inspiration_source,
      })
    : input.inspiration_source ?? null;

  const req: Requirement = {
    id: uid("req-"),
    project_id: project.id,
    iteration_id: poolIteration.id,
    module_l1_id: input.module_l1_id ?? null,
    module_l2_id: null,
    parent_id: input.parent_id ?? null,
    type: reqType,
    title: input.title?.trim() || "新功能点",
    sub_function: input.sub_function ?? null,
    detail_work: input.detail_work ?? null,
    acceptance_criteria: input.acceptance_criteria ?? null,
    priority: input.priority ?? null,
    status: deriveTaskStatusFromTags(statusTags),
    status_tags: statusTags,
    assignees: input.assignees ?? [],
    req_source: input.req_source ?? null,
    req_source_note: null,
    inspiration_source: inspiration,
    next_step: input.next_step ?? null,
    completed_at: done ? input.completed_at ?? nowIso() : input.completed_at ?? null,
    studio_idea_id: input.studio_idea_id ?? null,
    blocker_reason: null,
    sort_order: sortOrder,
    in_pool: true,
    category: input.category ?? null,
    stage_type: input.stage_type ?? null,
    optimization_notes: input.optimization_notes ?? null,
    known_issues: input.known_issues ?? null,
    submitted_at: nowIso().slice(0, 10),
    due_date: null,
    difficulty_notes: null,
    scenario: null,
    needs_discussion: false,
    prd_link: null,
    prototype_link: null,
    product_estimate_hours: input.product_estimate_hours ?? null,
    direct_hours: input.direct_hours ?? null,
    actual_hours: input.actual_hours ?? null,
    force_closed: false,
    tags: [],
    custom_fields: {},
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  if (input.submitted_at) req.submitted_at = input.submitted_at;
  db.requirements.push(req);

  const actorName = fromAgent
    ? AGENT_ACTOR_NAME
    : input.actor_name?.trim() || "产品";
  const action = input.studio_idea_id ? "sync" : "create";
  const log = await logActivity(db, {
    project_id: project.id,
    entity_type: "requirement",
    entity_id: req.id,
    field_name: action,
    old_value: fromAgent ? encodeAgentActivityNote(actorNote) : null,
    new_value: req.title,
    actor_name: actorName,
    actor_role: fromAgent ? "agent" : "admin",
  });

  await reconcileAncestorStatuses(db, req.parent_id);

  if (isSupabaseConfigured()) {
    await upsertRequirementRow(req);
    await persistActivityLog(log);
    memoryDb = db;
    return req;
  }

  await saveLocalDb(db);
  return req;
}

export async function createRequirementLink(input: {
  project_id: string;
  source_type: LinkEntityType;
  source_id: string;
  target_type: LinkEntityType;
  target_id: string;
  relation_type: LinkRelationType;
}): Promise<RequirementLink> {
  const db = await readDb();
  const link: RequirementLink = {
    id: uid(),
    project_id: input.project_id,
    source_type: input.source_type,
    source_id: input.source_id,
    target_type: input.target_type,
    target_id: input.target_id,
    relation_type: input.relation_type,
    created_at: nowIso(),
  };
  db.requirement_links = [...(db.requirement_links ?? []), link];
  if (isSupabaseConfigured()) {
    await upsertRequirementLinkRow(link);
    memoryDb = db;
    return link;
  }
  await saveLocalDb(db);
  return link;
}

export async function deleteRequirementLink(id: string): Promise<void> {
  const db = await readDb();
  db.requirement_links = (db.requirement_links ?? []).filter((l) => l.id !== id);
  if (isSupabaseConfigured()) {
    await deleteRequirementLinkRow(id);
    memoryDb = db;
    return;
  }
  await saveLocalDb(db);
}

export type StudioPoolSyncResult = {
  created: number;
  ideaSourceCount: number;
  evolutionSourceCount: number;
  skippedExisting: number;
  errors: string[];
  projectFound: boolean;
};

/** 已入需求池的灵感 id（排除演进伪 id evo:…） */
export async function listPooledStudioIdeaIds(): Promise<Set<string>> {
  const db = await readDb();
  const ids = new Set<string>();
  for (const r of db.requirements) {
    const sid = r.studio_idea_id?.trim();
    if (sid && !sid.startsWith("evo:")) ids.add(sid);
  }
  return ids;
}

async function markPooledIdeaConverted(ideaId: string, status?: string) {
  if (status === "converted" || status === "done" || status === "archived") return;
  try {
    const { updateStudioIdea } = await import("@/lib/studio/mutations");
    await updateStudioIdea(ideaId, { status: "converted" });
  } catch {
    // 灵感库不可写时不影响需求同步
  }
}

/** 将 Studio 灵感 + 演进记录同步进 PM 需求池（按 studio_idea_id 去重） */
export async function syncStudioIdeasIntoPool(
  pmProjectId: string,
  ideas: Array<{
    id: string;
    title: string;
    oneLineIdea?: string;
    whyItMatters?: string;
    triggerSource?: string;
    sourceChat?: string;
    chatTopic?: string;
    suggestedNextStep?: string;
    priority?: string;
    occurredAt?: string;
    completedAt?: string | null;
    status?: string;
  }>,
  evolutions: Array<{
    id: string;
    title: string;
    before?: string;
    after?: string;
    reason?: string;
    decision?: string;
    createdAt?: string;
  }> = [],
  options?: { actorNote?: string }
): Promise<StudioPoolSyncResult> {
  const empty: StudioPoolSyncResult = {
    created: 0,
    ideaSourceCount: ideas.length,
    evolutionSourceCount: evolutions.length,
    skippedExisting: 0,
    errors: [],
    projectFound: false,
  };
  if (!ideas.length && !evolutions.length) return empty;

  const db = await readDb();
  const project = db.projects.find((p) => p.id === pmProjectId || p.slug === pmProjectId);
  if (!project) return empty;

  const existingIdeaIds = new Set(
    db.requirements
      .filter((r) => r.project_id === project.id && r.studio_idea_id)
      .map((r) => r.studio_idea_id as string)
  );

  let created = 0;
  let skippedExisting = 0;
  const errors: string[] = [];

  for (const idea of ideas) {
    if (existingIdeaIds.has(idea.id)) {
      skippedExisting += 1;
      await markPooledIdeaConverted(idea.id, idea.status);
      continue;
    }
    const tags =
      idea.status === "done" || idea.completedAt
        ? ["完成"]
        : idea.status === "parked"
          ? ["搁置"]
          : ["待开始"];
    try {
      const windowNote =
        options?.actorNote ||
        idea.chatTopic ||
        idea.sourceChat ||
        idea.triggerSource ||
        "Studio 灵感同步";
      const createdReq = await createPoolRequirement(project.id, {
        title: idea.title,
        detail_work: [idea.oneLineIdea, idea.whyItMatters].filter(Boolean).join("\n\n") || null,
        inspiration_source: formatAgentInspiration({
          chatTopic: idea.chatTopic,
          sourceChat: idea.sourceChat,
          triggerSource: idea.triggerSource,
          windowNote,
        }),
        next_step: idea.suggestedNextStep || null,
        priority: idea.priority ?? null,
        status_tags: tags,
        studio_idea_id: idea.id,
        submitted_at: idea.occurredAt?.slice(0, 10) ?? undefined,
        completed_at: idea.completedAt ?? null,
        type: "epic",
        actor_name: AGENT_ACTOR_NAME,
        actor_note: windowNote,
      });
      await createRequirementLink({
        project_id: project.id,
        source_type: "idea",
        source_id: idea.id,
        target_type: "requirement",
        target_id: createdReq.id,
        relation_type: "from_idea",
      });
      existingIdeaIds.add(idea.id);
      created += 1;
      await markPooledIdeaConverted(idea.id, idea.status);
    } catch (error) {
      errors.push(
        `灵感「${idea.title}」: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  for (const evo of evolutions) {
    const key = `evo:${evo.id}`;
    if (existingIdeaIds.has(key)) {
      skippedExisting += 1;
      continue;
    }
    const body = [
      evo.after ? `变更后：${evo.after}` : "",
      evo.before ? `变更前：${evo.before}` : "",
      evo.reason ? `原因：${evo.reason}` : "",
      evo.decision ? `决策：${evo.decision}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      const windowNote = options?.actorNote || "Studio 演进同步";
      const createdReq = await createPoolRequirement(project.id, {
        title: evo.title,
        detail_work: body || null,
        inspiration_source: formatAgentInspiration({ windowNote }),
        status_tags: ["已记录"],
        studio_idea_id: key,
        submitted_at: evo.createdAt?.slice(0, 10) ?? undefined,
        type: "feature",
        actor_name: AGENT_ACTOR_NAME,
        actor_note: windowNote,
      });
      await createRequirementLink({
        project_id: project.id,
        source_type: "requirement",
        source_id: createdReq.id,
        target_type: "evolution",
        target_id: evo.id,
        relation_type: "has_evolution",
      });
      existingIdeaIds.add(key);
      created += 1;
    } catch (error) {
      errors.push(
        `演进「${evo.title}」: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    created,
    ideaSourceCount: ideas.length,
    evolutionSourceCount: evolutions.length,
    skippedExisting,
    errors,
    projectFound: true,
  };
}

export async function updatePoolRequirement(
  requirementId: string,
  updates: RequirementUpdates,
  actor: { name: string; role?: string }
) {
  const db = await readDb();
  const req = db.requirements.find((r) => r.id === requirementId);
  if (!req?.in_pool) throw new Error("需求不在需求池中");
  return updateRequirement(requirementId, updates, actor);
}

export async function deletePoolRequirement(requirementId: string) {
  await deletePoolRequirements([requirementId]);
}

export async function deletePoolRequirements(requirementIds: string[]) {
  const unique = [...new Set(requirementIds.filter(Boolean))];
  if (!unique.length) return 0;

  const db = await readDb();
  const toDelete = db.requirements.filter((r) => unique.includes(r.id) && r.in_pool);
  if (!toDelete.length) return 0;
  const idSet = new Set(toDelete.map((r) => r.id));

  const logs: ActivityLog[] = [];
  for (const req of toDelete) {
    logs.push(
      await logActivity(db, {
        project_id: req.project_id,
        entity_type: "requirement",
        entity_id: req.id,
        field_name: "delete",
        old_value: null,
        new_value: req.title,
        actor_name: "产品",
        actor_role: "admin",
      })
    );
  }

  db.requirements = db.requirements.filter((r) => !idSet.has(r.id));
  for (const child of db.requirements) {
    if (child.parent_id && idSet.has(child.parent_id)) child.parent_id = null;
  }
  db.acceptance_items = db.acceptance_items.filter((a) => !idSet.has(a.requirement_id));
  db.role_tasks = db.role_tasks.filter((t) => !idSet.has(t.requirement_id));

  if (isSupabaseConfigured()) {
    await deleteRequirementRows([...idSet]);
    for (const log of logs) await persistActivityLog(log);
    memoryDb = db;
    return toDelete.length;
  }

  await saveLocalDb(db);
  return toDelete.length;
}

/** 按 studio_idea_id（优先）+ 同项目同标题 去重，保留最早一条 */
export async function dedupePoolRequirements(projectId: string): Promise<number> {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!project) throw new Error("项目不存在");
  const pool = db.requirements
    .filter((r) => r.project_id === project.id && r.in_pool)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const remove = new Set<string>();
  const seenIdea = new Set<string>();
  const seenTitle = new Set<string>();
  for (const r of pool) {
    if (r.studio_idea_id) {
      if (seenIdea.has(r.studio_idea_id)) {
        remove.add(r.id);
        continue;
      }
      seenIdea.add(r.studio_idea_id);
    }
    const titleKey = r.title.trim();
    if (titleKey && seenTitle.has(titleKey)) {
      remove.add(r.id);
      continue;
    }
    if (titleKey) seenTitle.add(titleKey);
  }

  return deletePoolRequirements([...remove]);
}

export async function promotePoolRequirement(
  requirementId: string,
  targetIterationId: string,
  actor: { name: string; role?: string }
) {
  const db = await readDb();
  const req = db.requirements.find((r) => r.id === requirementId);
  if (!req?.in_pool) throw new Error("需求不在需求池中");

  const iteration = db.iterations.find((i) => i.id === targetIterationId);
  if (!iteration || iteration.project_id !== req.project_id) {
    throw new Error("目标迭代无效");
  }
  if (iteration.name === POOL_ITERATION_NAME) {
    throw new Error("不能规划回需求池迭代");
  }

  req.in_pool = false;
  req.iteration_id = targetIterationId;
  req.updated_at = nowIso();

  const acceptance: AcceptanceItem = {
    id: uid("acc-"),
    requirement_id: req.id,
    description: `${req.title} - 功能符合 PRD`,
    passed: null,
    note: req.optimization_notes,
    sort_order: 1,
  };
  db.acceptance_items.push(acceptance);

  await logActivity(db, {
    project_id: req.project_id,
    entity_type: "requirement",
    entity_id: req.id,
    field_name: "promote",
    old_value: null,
    new_value: iteration.name,
    actor_name: actor.name,
    actor_role: actor.role ?? "admin",
  });

  await saveDb(db);
  return req;
}

/** 对话框用：项目列表 + 各项目「需求池」与规划迭代 */
export async function listRequirementMigrateTargets(): Promise<{
  projects: Array<{ id: string; name: string; slug: string }>;
  plansByProjectId: Record<
    string,
    Array<{ id: string; name: string; isPool: boolean }>
  >;
}> {
  const projectsRaw = await getProjects();
  for (const p of projectsRaw) {
    await ensurePoolIteration(p.id);
  }

  const db = await readDb();
  const projects = [...db.projects]
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
    .map((p) => ({ id: p.id, name: p.name, slug: p.slug }));

  const plansByProjectId: Record<
    string,
    Array<{ id: string; name: string; isPool: boolean }>
  > = {};

  for (const p of db.projects) {
    const pool = db.iterations.find(
      (i) => i.project_id === p.id && i.name === POOL_ITERATION_NAME
    );
    const planning = db.iterations
      .filter((i) => i.project_id === p.id && i.name !== POOL_ITERATION_NAME)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ id: i.id, name: i.name, isPool: false }));
    plansByProjectId[p.id] = [
      ...(pool ? [{ id: pool.id, name: POOL_ITERATION_NAME, isPool: true }] : []),
      ...planning,
    ];
  }

  return { projects, plansByProjectId };
}

function collectPoolSubtreeIds(
  seedIds: string[],
  requirements: Requirement[]
): Set<string> {
  const byParent = new Map<string, string[]>();
  for (const r of requirements) {
    if (!r.parent_id) continue;
    const list = byParent.get(r.parent_id) ?? [];
    list.push(r.id);
    byParent.set(r.parent_id, list);
  }
  const out = new Set<string>();
  const stack = [...seedIds];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const childId of byParent.get(id) ?? []) stack.push(childId);
  }
  return out;
}

/**
 * 需求池多选迁移：可换项目 / 计划（需求池或一期二期等）。
 * 选中父时整棵子树一并迁；父未迁走时子节点断开 parent_id。
 */
export async function migratePoolRequirements(input: {
  requirementIds: string[];
  targetProjectId: string;
  /** 目标迭代 id（含目标项目的需求池迭代） */
  targetIterationId: string;
  actor?: { name: string; role?: string };
}): Promise<{ moved: number; ids: string[] }> {
  const uniqueSeeds = [...new Set(input.requirementIds.filter(Boolean))];
  if (!uniqueSeeds.length) return { moved: 0, ids: [] };

  const db = await readDb();
  const targetProject = db.projects.find(
    (p) => p.id === input.targetProjectId || p.slug === input.targetProjectId
  );
  if (!targetProject) throw new Error("目标项目不存在");

  const poolIteration = await ensurePoolIteration(targetProject.id);
  const targetIteration = db.iterations.find((i) => i.id === input.targetIterationId);
  if (!targetIteration || targetIteration.project_id !== targetProject.id) {
    throw new Error("目标计划无效");
  }

  const toPool = targetIteration.name === POOL_ITERATION_NAME;
  if (toPool && targetIteration.id !== poolIteration.id) {
    throw new Error("目标需求池无效");
  }

  const subtreeIds = collectPoolSubtreeIds(uniqueSeeds, db.requirements);
  const toMove = db.requirements.filter((r) => subtreeIds.has(r.id) && r.in_pool);
  if (!toMove.length) throw new Error("没有可迁移的需求池条目");

  const moveSet = new Set(toMove.map((r) => r.id));
  const actorName = input.actor?.name ?? "产品";
  const actorRole = input.actor?.role ?? "admin";
  const stamp = nowIso();
  const logs: ActivityLog[] = [];
  const newAcceptance: AcceptanceItem[] = [];

  for (const req of toMove) {
    const oldProjectId = req.project_id;
    const oldIter = db.iterations.find((i) => i.id === req.iteration_id);
    const oldLabel = `${oldProjectId}/${oldIter?.name ?? req.iteration_id}`;

    if (req.parent_id && !moveSet.has(req.parent_id)) {
      req.parent_id = null;
    }

    req.project_id = targetProject.id;
    req.iteration_id = targetIteration.id;
    req.in_pool = toPool;
    req.updated_at = stamp;

    if (!toPool) {
      const hasAcc = db.acceptance_items.some((a) => a.requirement_id === req.id);
      if (!hasAcc) {
        const acceptance: AcceptanceItem = {
          id: uid("acc-"),
          requirement_id: req.id,
          description: `${req.title} - 功能符合 PRD`,
          passed: null,
          note: req.optimization_notes,
          sort_order: 1,
        };
        db.acceptance_items.push(acceptance);
        newAcceptance.push(acceptance);
      }
    }

    logs.push(
      await logActivity(db, {
        project_id: targetProject.id,
        entity_type: "requirement",
        entity_id: req.id,
        field_name: "migrate",
        old_value: oldLabel,
        new_value: `${targetProject.id}/${targetIteration.name}`,
        actor_name: actorName,
        actor_role: actorRole,
      })
    );

    if (oldProjectId !== targetProject.id) {
      // 源项目也留一条痕迹，便于审计
      logs.push(
        await logActivity(db, {
          project_id: oldProjectId,
          entity_type: "requirement",
          entity_id: req.id,
          field_name: "migrate_out",
          old_value: oldLabel,
          new_value: `${targetProject.id}/${targetIteration.name}`,
          actor_name: actorName,
          actor_role: actorRole,
        })
      );
    }
  }

  const updatedAttachments: RequirementAttachment[] = [];
  for (const att of db.requirement_attachments ?? []) {
    if (moveSet.has(att.requirement_id) && att.project_id !== targetProject.id) {
      att.project_id = targetProject.id;
      updatedAttachments.push(att);
    }
  }

  const updatedLinks: RequirementLink[] = [];
  for (const link of db.requirement_links ?? []) {
    const touchesMoved =
      (link.source_type === "requirement" && moveSet.has(link.source_id)) ||
      (link.target_type === "requirement" && moveSet.has(link.target_id));
    if (touchesMoved && link.project_id !== targetProject.id) {
      link.project_id = targetProject.id;
      updatedLinks.push(link);
    }
  }

  if (isSupabaseConfigured()) {
    for (const req of toMove) await upsertRequirementRow(req);
    for (const acc of newAcceptance) await upsertAcceptanceItemRow(acc);
    for (const att of updatedAttachments) await upsertRequirementAttachmentRow(att);
    for (const link of updatedLinks) await upsertRequirementLinkRow(link);
    for (const log of logs) await persistActivityLog(log);
    memoryDb = db;
  } else {
    await saveLocalDb(db);
  }

  return { moved: toMove.length, ids: toMove.map((r) => r.id) };
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const db = await readDb();
  return (db.project_members ?? [])
    .filter((m) => m.project_id === projectId)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export async function createProjectMember(input: {
  project_id: string;
  name: string;
  role?: RoleType | null;
}) {
  const db = await readDb();
  const name = input.name.trim();
  if (!name) throw new Error("姓名不能为空");
  const exists = (db.project_members ?? []).some(
    (m) => m.project_id === input.project_id && m.name === name
  );
  if (exists) throw new Error("该成员已存在");

  const member: ProjectMember = {
    id: uid("mem-"),
    project_id: input.project_id,
    name,
    role: input.role ?? null,
    is_active: true,
    created_at: nowIso(),
  };
  if (!db.project_members) db.project_members = [];
  db.project_members.push(member);
  await saveDb(db);
  return member;
}

export async function updateProjectMember(
  memberId: string,
  updates: Partial<Pick<ProjectMember, "name" | "role" | "is_active">>
) {
  const db = await readDb();
  const member = db.project_members?.find((m) => m.id === memberId);
  if (!member) throw new Error("成员不存在");

  if (updates.name) {
    const name = updates.name.trim();
    const dup = (db.project_members ?? []).some(
      (m) => m.project_id === member.project_id && m.name === name && m.id !== memberId
    );
    if (dup) throw new Error("该姓名已被使用");
    member.name = name;
  }
  if (updates.role !== undefined) member.role = updates.role;
  if (updates.is_active !== undefined) member.is_active = updates.is_active;

  await saveDb(db);
  return member;
}

export async function deleteProjectMember(memberId: string, clearAssignees = false) {
  const db = await readDb();
  const member = db.project_members?.find((m) => m.id === memberId);
  if (!member) throw new Error("成员不存在");

  if (clearAssignees) {
    for (const task of db.role_tasks) {
      const req = db.requirements.find((r) => r.id === task.requirement_id);
      if (req?.project_id === member.project_id && task.assignee === member.name) {
        task.assignee = null;
        task.updated_at = nowIso();
      }
    }
    for (const bug of db.bugs) {
      if (bug.project_id === member.project_id && bug.assignee === member.name) {
        bug.assignee = null;
        bug.updated_at = nowIso();
      }
    }
  }

  db.project_members = (db.project_members ?? []).filter((m) => m.id !== memberId);
  await saveDb(db);
}

export async function createPoolColumnDef(input: {
  project_id: string;
  label: string;
  column_type: PoolColumnType;
  options?: string[];
}) {
  const db = await readDb();
  const label = input.label.trim();
  if (!label) throw new Error("列名不能为空");

  const baseKey = label
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\u4e00-\u9fa5]/g, "")
    .slice(0, 32);
  let key = baseKey || `col_${uid().slice(0, 6)}`;
  let suffix = 1;
  while (
    (db.pool_column_defs ?? []).some(
      (d) => d.project_id === input.project_id && d.key === key
    )
  ) {
    key = `${baseKey}_${suffix++}`;
  }

  const def: PoolColumnDef = {
    id: uid("pcd-"),
    project_id: input.project_id,
    key,
    label,
    column_type: input.column_type,
    options: input.options ?? [],
    sort_order:
      (db.pool_column_defs ?? []).filter((d) => d.project_id === input.project_id).length + 1,
    is_active: true,
    created_at: nowIso(),
  };
  if (!db.pool_column_defs) db.pool_column_defs = [];
  db.pool_column_defs.push(def);
  await saveDb(db);
  return def;
}

export async function deletePoolColumnDef(defId: string) {
  const db = await readDb();
  db.pool_column_defs = (db.pool_column_defs ?? []).filter((d) => d.id !== defId);
  await saveDb(db);
}

export async function updateProjectPoolTagOptions(projectId: string, tagOptions: string[]) {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!project) throw new Error("项目不存在");
  project.pool_tag_options = tagOptions.map((t) => t.trim()).filter(Boolean);
  await saveDb(db);
  return project;
}

/** 项目下全部模块（各迭代），按 sort_order */
export async function listProjectModules(projectId: string): Promise<ModuleNode[]> {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!project) return [];
  const iterIds = new Set(
    db.iterations.filter((i) => i.project_id === project.id).map((i) => i.id)
  );
  return db.modules
    .filter((m) => iterIds.has(m.iteration_id))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "zh"));
}

/** 新增模块：顶级挂需求池迭代；子模块挂在父同迭代（最多两级） */
export async function createProjectModule(input: {
  projectId: string;
  name: string;
  parentId?: string | null;
}): Promise<ModuleNode> {
  const name = input.name.trim();
  if (!name) throw new Error("模块名不能为空");

  const db = await readDb();
  const project = db.projects.find((p) => p.id === input.projectId || p.slug === input.projectId);
  if (!project) throw new Error("项目不存在");

  let iterationId: string;
  let parentId: string | null = null;
  let level: 1 | 2 = 1;

  if (input.parentId) {
    const parent = db.modules.find((m) => m.id === input.parentId);
    if (!parent) throw new Error("父模块不存在");
    const parentIter = db.iterations.find((i) => i.id === parent.iteration_id);
    if (!parentIter || parentIter.project_id !== project.id) {
      throw new Error("父模块不属于本项目");
    }
    if (parent.level !== 1) throw new Error("最多两级模块，请挂在一级模块下");
    iterationId = parent.iteration_id;
    parentId = parent.id;
    level = 2;
  } else {
    const pool = await ensurePoolIteration(project.id);
    iterationId = pool.id;
  }

  const siblings = db.modules.filter(
    (m) => m.iteration_id === iterationId && m.parent_id === parentId
  );
  const mod: ModuleNode = {
    id: uid("mod-"),
    iteration_id: iterationId,
    parent_id: parentId,
    name,
    level,
    estimate_level: "requirement",
    module_estimate_hours: null,
    sort_order: siblings.length + 1,
  };
  db.modules.push(mod);
  await saveDb(db);
  return mod;
}

export async function updateProjectModule(input: {
  moduleId: string;
  name: string;
}): Promise<ModuleNode> {
  const name = input.name.trim();
  if (!name) throw new Error("模块名不能为空");
  const db = await readDb();
  const mod = db.modules.find((m) => m.id === input.moduleId);
  if (!mod) throw new Error("模块不存在");
  mod.name = name;
  await saveDb(db);
  return mod;
}

export async function deleteProjectModule(moduleId: string): Promise<void> {
  const db = await readDb();
  const root = db.modules.find((m) => m.id === moduleId);
  if (!root) throw new Error("模块不存在");

  const toRemove = new Set<string>([moduleId]);
  for (const m of db.modules) {
    if (m.parent_id && toRemove.has(m.parent_id)) toRemove.add(m.id);
  }
  // 再扫一遍以防多层（当前最多两级）
  for (const m of db.modules) {
    if (m.parent_id && toRemove.has(m.parent_id)) toRemove.add(m.id);
  }

  db.modules = db.modules.filter((m) => !toRemove.has(m.id));
  for (const r of db.requirements) {
    if (r.module_l1_id && toRemove.has(r.module_l1_id)) r.module_l1_id = null;
    if (r.module_l2_id && toRemove.has(r.module_l2_id)) r.module_l2_id = null;
  }
  await saveDb(db);
}

export async function claimShareAssignee(shareToken: string, displayName: string) {
  const linkData = await getShareLinkByToken(shareToken);
  if (!linkData?.bundle) throw new Error("无效或已停用的链接");

  const name = displayName.trim();
  if (!name) throw new Error("请填写姓名");

  const db = await readDb();
  const roster = (db.project_members ?? []).filter(
    (m) => m.project_id === linkData.link.project_id && m.is_active
  );
  if (roster.length > 0) {
    const member = roster.find((m) => m.name === name);
    if (!member) {
      throw new Error("姓名不在项目成员名册中，请联系产品添加或核对拼写");
    }
    if (
      member.role &&
      linkData.link.role !== "admin" &&
      linkData.link.role !== "readonly" &&
      linkData.link.role !== "test" &&
      member.role !== linkData.link.role
    ) {
      throw new Error(`该链接为${linkData.link.role}角色，与成员岗位不匹配`);
    }
  }

  let updated = 0;
  const { link } = linkData;
  for (const task of db.role_tasks) {
    const req = db.requirements.find((r) => r.id === task.requirement_id);
    if (!req || req.in_pool) continue;
    if (link.role !== "admin" && link.role !== task.role) continue;
    if (task.assignee) continue;
    task.assignee = name;
    task.updated_at = nowIso();
    updated++;
  }

  if (updated > 0) await saveDb(db);
  return { updated, displayName: name };
}

export { uid, nowIso };
