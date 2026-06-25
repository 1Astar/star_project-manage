import fs from "fs/promises";
import path from "path";
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

async function ensureDb(): Promise<DatabaseSnapshot> {
  if (memoryDb) return memoryDb;

  const dbFile = getDbFile();
  const dataDir = getDataDir();

  try {
    await fs.mkdir(dataDir, { recursive: true });
    const raw = await fs.readFile(dbFile, "utf8");
    memoryDb = JSON.parse(raw) as DatabaseSnapshot;
    return memoryDb;
  } catch {
    const seeded = (await readSeedFile()) ?? createSeedData();
    memoryDb = seeded;
    try {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.writeFile(dbFile, JSON.stringify(seeded, null, 2), "utf8");
    } catch {
      // Vercel 等项目目录只读时，仅使用内存 + /tmp 不可用时的降级
    }
    return seeded;
  }
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

function createSeedData(): DatabaseSnapshot {
  const petProjectId = uid("proj-");
  const controllerProjectId = uid("proj-");
  const petIterationId = uid("iter-");
  const controllerIterationId = uid("iter-");

  const petReqs: Requirement[] = [
    {
      id: uid("req-"),
      project_id: petProjectId,
      iteration_id: petIterationId,
      module_l1_id: null,
      module_l2_id: null,
      title: "主页页面整体结构优化",
      sub_function: null,
      detail_work: null,
      acceptance_criteria: "主页结构符合设计稿，导航与模块分区清晰",
      priority: null,
      status: "in_progress",
      blocker_reason: null,
      sort_order: 1,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: uid("req-"),
      project_id: petProjectId,
      iteration_id: petIterationId,
      module_l1_id: null,
      module_l2_id: null,
      title: "安静状态下的陪伴专注横幅",
      sub_function: "安静状态下的陪伴专注横幅",
      detail_work: null,
      acceptance_criteria: "安静模式下正确展示专注横幅，交互符合 PRD",
      priority: null,
      status: "testing",
      blocker_reason: null,
      sort_order: 2,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: uid("req-"),
      project_id: petProjectId,
      iteration_id: petIterationId,
      module_l1_id: null,
      module_l2_id: null,
      title: "推送模块（推送/勿扰/喝水）",
      sub_function: null,
      detail_work: "后端整体评估 40 小时，覆盖三个子模块",
      acceptance_criteria: "推送、勿扰、喝水三条链路均可独立验收",
      priority: "P0",
      status: "in_progress",
      blocker_reason: null,
      sort_order: 3,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ];

  const controllerReqs: Requirement[] = [
    {
      id: uid("req-"),
      project_id: controllerProjectId,
      iteration_id: controllerIterationId,
      module_l1_id: null,
      module_l2_id: null,
      title: "下控遮罩等待界面",
      sub_function: "下控遮罩等待界面",
      detail_work: null,
      acceptance_criteria: "下控流程中遮罩等待界面展示正确，超时处理符合规范",
      priority: "P0",
      status: "acceptance",
      blocker_reason: null,
      sort_order: 1,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: uid("req-"),
      project_id: controllerProjectId,
      iteration_id: controllerIterationId,
      module_l1_id: null,
      module_l2_id: null,
      title: "设备归属和批量迁移",
      sub_function: "设备归属和批量迁移",
      detail_work: null,
      acceptance_criteria: "批量迁移后设备归属关系正确，日志可追溯",
      priority: "P0",
      status: "testing",
      blocker_reason: null,
      sort_order: 2,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ];

  const petTasks: RoleTask[] = [
    {
      id: uid("task-"),
      requirement_id: petReqs[0].id,
      role: "ui",
      assignee: "游春梅",
      estimate_hours: null,
      actual_hours: null,
      start_date: null,
      end_date: null,
      status: "in_progress",
      notes: null,
      blocker_reason: null,
      progress_percent: 30,
      updated_at: nowIso(),
    },
    {
      id: uid("task-"),
      requirement_id: petReqs[0].id,
      role: "frontend",
      assignee: "陈伟平",
      estimate_hours: null,
      actual_hours: null,
      start_date: null,
      end_date: null,
      status: "pending",
      notes: null,
      blocker_reason: null,
      progress_percent: 0,
      updated_at: nowIso(),
    },
    {
      id: uid("task-"),
      requirement_id: petReqs[1].id,
      role: "backend",
      assignee: "李德堂",
      estimate_hours: 16,
      actual_hours: null,
      start_date: "2026-06-01",
      end_date: "2026-06-05",
      status: "testing",
      notes: "已提测",
      blocker_reason: null,
      progress_percent: 100,
      updated_at: nowIso(),
    },
    {
      id: uid("task-"),
      requirement_id: petReqs[1].id,
      role: "frontend",
      assignee: "陈伟平",
      estimate_hours: 24,
      actual_hours: null,
      start_date: "2026-06-03",
      end_date: "2026-06-08",
      status: "testing",
      notes: null,
      blocker_reason: null,
      progress_percent: 100,
      updated_at: nowIso(),
    },
    {
      id: uid("task-"),
      requirement_id: petReqs[2].id,
      role: "backend",
      assignee: "李德堂",
      estimate_hours: 40,
      actual_hours: null,
      start_date: "2026-06-01",
      end_date: "2026-06-15",
      status: "in_progress",
      notes: "模块级工时，覆盖推送/勿扰/喝水",
      blocker_reason: null,
      progress_percent: 21.32,
      updated_at: nowIso(),
    },
  ];

  const controllerTasks: RoleTask[] = [
    {
      id: uid("task-"),
      requirement_id: controllerReqs[0].id,
      role: "backend",
      assignee: "谢鑫",
      estimate_hours: 12,
      actual_hours: null,
      start_date: "2026-04-24",
      end_date: "2026-05-06",
      status: "acceptance",
      notes: null,
      blocker_reason: null,
      progress_percent: 100,
      updated_at: nowIso(),
    },
    {
      id: uid("task-"),
      requirement_id: controllerReqs[0].id,
      role: "frontend",
      assignee: "陈伟平",
      estimate_hours: 4,
      actual_hours: null,
      start_date: "2026-04-27",
      end_date: "2026-05-15",
      status: "acceptance",
      notes: null,
      blocker_reason: null,
      progress_percent: 100,
      updated_at: nowIso(),
    },
    {
      id: uid("task-"),
      requirement_id: controllerReqs[1].id,
      role: "backend",
      assignee: "谢鑫",
      estimate_hours: 8,
      actual_hours: null,
      start_date: null,
      end_date: null,
      status: "testing",
      notes: null,
      blocker_reason: null,
      progress_percent: 100,
      updated_at: nowIso(),
    },
  ];

  const acceptanceItems: AcceptanceItem[] = [
    ...petReqs.flatMap((req, idx) => [
      {
        id: uid("acc-"),
        requirement_id: req.id,
        description: `${req.title} - 功能符合 PRD`,
        passed: idx === 0 ? null : idx === 1 ? false : null,
        note: idx === 1 ? "横幅在横屏下位置偏移" : null,
        sort_order: 1,
      },
    ]),
    ...controllerReqs.flatMap((req) => [
      {
        id: uid("acc-"),
        requirement_id: req.id,
        description: `${req.title} - 验收标准达成`,
        passed: null,
        note: null,
        sort_order: 1,
      },
    ]),
  ];

  const frontendToken = generateShareToken();
  const backendToken = generateShareToken();
  const testToken = generateShareToken();

  return {
    projects: [
      {
        id: petProjectId,
        name: "AI 宠物",
        slug: "ai-pet",
        description: "宠物 App 优化需求管理",
        created_at: nowIso(),
      },
      {
        id: controllerProjectId,
        name: "AI 控制器",
        slug: "ai-controller",
        description: "元井 AI 控制器优化需求管理",
        created_at: nowIso(),
      },
    ],
    iterations: [
      {
        id: petIterationId,
        project_id: petProjectId,
        name: "20260610 优化版本",
        sort_order: 1,
        created_at: nowIso(),
      },
      {
        id: controllerIterationId,
        project_id: controllerProjectId,
        name: "20260417 元井AI控制器",
        sort_order: 1,
        created_at: nowIso(),
      },
    ],
    modules: [],
    requirements: [...petReqs, ...controllerReqs],
    acceptance_items: acceptanceItems,
    role_tasks: [...petTasks, ...controllerTasks],
    test_records: [],
    acceptance_records: [],
    share_links: [
      {
        id: uid("link-"),
        project_id: petProjectId,
        role: "frontend",
        label: "前端协作链接",
        token_hash: hashToken(frontendToken),
        is_active: true,
        created_at: nowIso(),
        plain_token: frontendToken,
      },
      {
        id: uid("link-"),
        project_id: petProjectId,
        role: "backend",
        label: "后端协作链接",
        token_hash: hashToken(backendToken),
        is_active: true,
        created_at: nowIso(),
        plain_token: backendToken,
      },
      {
        id: uid("link-"),
        project_id: petProjectId,
        role: "test",
        label: "测试协作链接",
        token_hash: hashToken(testToken),
        is_active: true,
        created_at: nowIso(),
        plain_token: testToken,
      },
    ],
    prototypes: [],
    bugs: [],
    notifications: [
      {
        id: uid("notif-"),
        project_id: petProjectId,
        recipient_name: "产品",
        type: "acceptance_pending",
        title: "2 条需求待产品验收",
        body: "安静状态下的陪伴专注横幅 等需求已进入待验收",
        link: `/projects/${petProjectId}/board`,
        is_read: false,
        created_at: nowIso(),
      },
    ],
    activity_logs: [],
  };
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
    bugs,
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
