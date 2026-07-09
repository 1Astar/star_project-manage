import fs from "fs/promises";
import path from "path";
import { createSeedData } from "@/lib/db/seed-data";
import { readSupabaseDb, writeSupabaseDb, updateProjectById, upsertGitActivities } from "@/lib/db/supabase-store";
import type { DatabaseSnapshot } from "@/lib/db/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
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
  GitActivity,
  Iteration,
  PoolColumnDef,
  PoolColumnType,
  Project,
  ProjectMember,
  Prototype,
  Requirement,
  RequirementComment,
  RequirementUpdates,
  RoleTask,
  RoleType,
  ShareLink,
  TestRecord,
} from "@/lib/types";
import { REQUIREMENT_POOL_DEFAULTS } from "@/lib/types";

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

function uid(prefix = ""): string {
  return `${prefix}${crypto.randomUUID()}`;
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
  return {
    ...REQUIREMENT_POOL_DEFAULTS,
    ...req,
    tags: req.tags ?? [],
    custom_fields: req.custom_fields ?? {},
    submitted_at:
      req.submitted_at ?? (req.created_at ? req.created_at.slice(0, 10) : null),
  };
}

function normalizeDb(db: DatabaseSnapshot): DatabaseSnapshot {
  return {
    ...db,
    comments: db.comments ?? [],
    git_activities: db.git_activities ?? [],
    project_members: db.project_members ?? [],
    pool_column_defs: (db.pool_column_defs ?? []).map((def) => ({
      ...def,
      options: Array.isArray(def.options) ? def.options : [],
    })),
    projects: db.projects.map(normalizeProject),
    requirements: db.requirements.map(normalizeRequirement),
  };
}

function normalizeProject(project: Project): Project {
  return {
    ...project,
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

  const repoFullName = input.repo_full_name?.trim() || null;
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
    vercel_project_id: input.vercel_project_id?.trim() || null,
    vercel_deployment_url: input.vercel_deployment_url?.trim() || null,
  };

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
) {
  db.activity_logs.unshift({
    ...entry,
    id: uid("log-"),
    created_at: nowIso(),
  });
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
  const { custom_fields, ...rest } = updates;
  Object.assign(req, rest, { updated_at: nowIso() });
  if (custom_fields) {
    req.custom_fields = { ...req.custom_fields, ...custom_fields };
  }

  for (const [field, value] of Object.entries({
    ...rest,
    ...(custom_fields ? { custom_fields } : {}),
  })) {
    const oldVal =
      field === "custom_fields"
        ? JSON.stringify(before.custom_fields ?? {})
        : String((before as Record<string, unknown>)[field] ?? "");
    const newVal =
      field === "custom_fields"
        ? JSON.stringify(req.custom_fields ?? {})
        : field === "tags"
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

  await saveDb(db);
  return req;
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
  return {
    project,
    requirement,
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
    link: `/share/bug/${bug.id}`,
    is_read: false,
    created_at: nowIso(),
  });
  await saveDb(db);
  return bug;
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
  const pendingTasks = db.role_tasks.filter(
    (t) => t.status !== "done" && t.status !== "blocked"
  );
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

export async function ensurePoolIteration(projectId: string): Promise<Iteration> {
  const db = await readDb();
  let iteration = db.iterations.find(
    (i) => i.project_id === projectId && i.name === POOL_ITERATION_NAME
  );
  if (!iteration) {
    iteration = {
      id: uid("iter-"),
      project_id: projectId,
      name: POOL_ITERATION_NAME,
      sort_order: -1,
      created_at: nowIso(),
    };
    db.iterations.push(iteration);
    await saveDb(db);
  }
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
      | "optimization_notes"
      | "known_issues"
      | "module_l1_id"
      | "sub_function"
    >
  >
) {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!project) throw new Error("项目不存在");

  const poolIteration = await ensurePoolIteration(project.id);
  const sortOrder =
    db.requirements.filter((r) => r.project_id === project.id && r.in_pool).length + 1;

  const req: Requirement = {
    id: uid("req-"),
    project_id: project.id,
    iteration_id: poolIteration.id,
    module_l1_id: input.module_l1_id ?? null,
    module_l2_id: null,
    title: input.title?.trim() || "新功能点",
    sub_function: input.sub_function ?? null,
    detail_work: null,
    acceptance_criteria: null,
    priority: input.priority ?? null,
    status: input.status ?? "pending",
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
    product_estimate_hours: null,
    tags: [],
    custom_fields: {},
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  db.requirements.push(req);
  await saveDb(db);
  return req;
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
  const db = await readDb();
  const req = db.requirements.find((r) => r.id === requirementId);
  if (!req?.in_pool) throw new Error("需求不在需求池中");
  db.requirements = db.requirements.filter((r) => r.id !== requirementId);
  db.acceptance_items = db.acceptance_items.filter((a) => a.requirement_id !== requirementId);
  db.role_tasks = db.role_tasks.filter((t) => t.requirement_id !== requirementId);
  await saveDb(db);
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
    field_name: "in_pool",
    old_value: "true",
    new_value: "false",
    actor_name: actor.name,
    actor_role: actor.role ?? "admin",
  });

  await saveDb(db);
  return req;
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
