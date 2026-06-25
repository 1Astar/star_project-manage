import fs from "fs/promises";
import path from "path";
import { createSeedData } from "@/lib/db/seed-data";
import { generateShareToken, hashToken } from "@/lib/utils";
import type {
  AcceptanceItem,
  AcceptanceRecord,
  ActivityLog,
  Bug,
  Iteration,
  ModuleNode,
  NotificationItem,
  Project,
  Prototype,
  PrototypeAnnotation,
  Requirement,
  RoleTask,
  ShareLink,
  TestRecord,
} from "@/lib/types";

export interface DatabaseSnapshot {
  projects: Project[];
  iterations: Iteration[];
  modules: ModuleNode[];
  requirements: Requirement[];
  acceptance_items: AcceptanceItem[];
  role_tasks: RoleTask[];
  test_records: TestRecord[];
  acceptance_records: AcceptanceRecord[];
  share_links: Array<ShareLink & { plain_token?: string }>;
  prototypes: Prototype[];
  prototype_annotations: PrototypeAnnotation[];
  bugs: Bug[];
  notifications: NotificationItem[];
  activity_logs: ActivityLog[];
}

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

async function readSeedFile(): Promise<DatabaseSnapshot | null> {
  try {
    const raw = await fs.readFile(SEED_FILE, "utf8");
    return JSON.parse(raw) as DatabaseSnapshot;
  } catch {
    return null;
  }
}

function normalizeDb(db: DatabaseSnapshot): DatabaseSnapshot {
  if (!db.prototype_annotations) {
    db.prototype_annotations = [];
  }
  return db;
}

function isValidDb(db: DatabaseSnapshot | null | undefined): db is DatabaseSnapshot {
  return Boolean(db?.projects?.length && db.requirements?.length);
}

function projectSlug(db: DatabaseSnapshot, projectId: string): string {
  return db.projects.find((p) => p.id === projectId)?.slug ?? projectId;
}

function requirementLink(db: DatabaseSnapshot, requirement: Requirement): string {
  return `/projects/${projectSlug(db, requirement.project_id)}/requirements/${requirement.id}`;
}

async function ensureDb(): Promise<DatabaseSnapshot> {
  if (isValidDb(memoryDb)) return memoryDb;

  // Vercel 无持久化存储：始终从仓库内种子文件启动，保证 ID 与链接稳定
  if (process.env.VERCEL === "1") {
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
    // 继续尝试种子文件
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

async function saveDb(db: DatabaseSnapshot): Promise<void> {
  memoryDb = db;
  const dbFile = getDbFile();
  try {
    await fs.mkdir(getDataDir(), { recursive: true });
    await fs.writeFile(dbFile, JSON.stringify(db, null, 2), "utf8");
  } catch {
    // 写入失败时仍保留 memoryDb，避免服务端崩溃
  }
}

function uid(prefix = ""): string {
  return `${prefix}${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
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
  const requirements = db.requirements.filter((r) => r.project_id === project.id);
  const requirementIds = new Set(requirements.map((r) => r.id));
  const role_tasks = db.role_tasks.filter((t) => requirementIds.has(t.requirement_id));
  const acceptance_items = db.acceptance_items.filter((a) =>
    requirementIds.has(a.requirement_id)
  );
  const share_links = db.share_links.filter((l) => l.project_id === project.id);
  const notifications = db.notifications.filter((n) => n.project_id === project.id);
  const prototypes = db.prototypes.filter((p) => p.project_id === project.id);
  const prototype_annotations = db.prototype_annotations.filter(
    (a) => a.project_id === project.id
  );
  const bugs = db.bugs.filter((b) => b.project_id === project.id);

  return {
    project,
    iterations,
    requirements,
    role_tasks,
    acceptance_items,
    share_links,
    notifications,
    prototypes,
    prototype_annotations,
    bugs,
  };
}

export async function syncPrototypeAnnotations(
  projectId: string,
  annotations: Array<{
    pinmark_id: string;
    acceptance_item_id?: string | null;
    requirement_id?: string | null;
    title?: string | null;
    description?: string | null;
    annotation_type?: string | null;
    shape?: "point" | "rect" | null;
    payload: Record<string, unknown>;
  }>,
  actor: { name: string; role?: string }
) {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!project) throw new Error("项目不存在");

  const now = nowIso();
  const requirementIds = new Set(
    db.requirements.filter((r) => r.project_id === project.id).map((r) => r.id)
  );
  const acceptanceIds = new Set(
    db.acceptance_items
      .filter((a) => requirementIds.has(a.requirement_id))
      .map((a) => a.id)
  );

  db.prototype_annotations = db.prototype_annotations.filter(
    (a) => a.project_id !== project.id
  );

  for (const item of annotations) {
    const acceptanceItemId = item.acceptance_item_id ?? null;
    const requirementId = item.requirement_id ?? null;
    if (acceptanceItemId && !acceptanceIds.has(acceptanceItemId)) {
      continue;
    }
    if (requirementId && !requirementIds.has(requirementId)) {
      continue;
    }

    db.prototype_annotations.push({
      id: uid("pann-"),
      project_id: project.id,
      pinmark_id: item.pinmark_id,
      acceptance_item_id: acceptanceItemId,
      requirement_id: requirementId,
      title: item.title ?? null,
      description: item.description ?? null,
      annotation_type: item.annotation_type ?? null,
      shape: item.shape ?? null,
      payload: item.payload,
      updated_at: now,
    });
  }

  await logActivity(db, {
    project_id: project.id,
    entity_type: "prototype_annotation",
    entity_id: project.id,
    field_name: "sync",
    old_value: null,
    new_value: String(annotations.length),
    actor_name: actor.name,
    actor_role: actor.role ?? "admin",
  });

  await saveDb(db);
  return db.prototype_annotations.filter((a) => a.project_id === project.id);
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
      link: requirementLink(db, req),
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
      link: requirementLink(db, req),
      is_read: false,
      created_at: nowIso(),
    });
  }

  await saveDb(db);
  return record;
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
        link: requirementLink(db, req),
        is_read: false,
        created_at: nowIso(),
      });
      created++;
    }
  }
  if (created > 0) await saveDb(db);
  return { created };
}

export function canShareRoleUpdateTask(
  linkRole: string,
  taskRole: string
): boolean {
  if (linkRole === "admin" || linkRole === "readonly") return linkRole === "admin";
  if (linkRole === "test") return false;
  return linkRole === taskRole;
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

export { uid, nowIso };
