import type { Requirement, RequirementType } from "@/lib/types";
import { AGENT_ACTOR_NAME } from "@/lib/cursor-actor";

export const STAR_PM_DEFAULT_MODULES = [
  "工作台",
  "项目库",
  "灵感",
  "需求任务",
  "迭代记录",
  "资源中心",
  "Git",
  "设置",
] as const;

/** 父 epic 标题 → 匹配关键词 */
export const EPIC_RULES: Array<{ epic: string; patterns: RegExp[] }> = [
  {
    epic: "灵感捕获与整理",
    patterns: [
      /灵感/,
      /\bIdea\b/i,
      /capture/i,
      /inbox/i,
      /停车场/,
      /脑暴/,
      /digest/i,
      /星图/,
      /收件箱/,
      /记忆字段/,
      /get_idea|search.*灵感/i,
      /ideas\/analyze/i,
      /AI 拆解|AI 评估/,
    ],
  },
  {
    epic: "今日工作台与驾驶舱",
    patterns: [
      /工作台/,
      /驾驶舱/,
      /今日焦点|今日清单|今日统计|每日工作总结|收工小结/,
      /明日待办/,
      /星球日历/,
      /待验收|需你跟进/,
      /主线/,
      /Workbench/i,
      /退出登录/,
      /视觉统一|配置存本浏览器/,
    ],
  },
  {
    epic: "项目与 Studio 链路",
    patterns: [
      /项目库/,
      /Studio/,
      /转成项目|转项目|convert/i,
      /父子树|parent_id.*项目|项目父子/,
      /恢复卡/,
      /新建项目/,
      /信息架构统一/,
      /退出.*返回/,
      /关联项目.*studio_tasks|同步写入.*studio_tasks/,
    ],
  },
  {
    epic: "Git / 部署与环境配置",
    patterns: [
      /\bGit\b/i,
      /Vercel/i,
      /部署/,
      /Cron/i,
      /[Mm]igration/,
      /种子 SQL|014 种子/,
      /stdio 落盘/,
      /仓库|Monorepo|总仓|node_modules/,
      /Supabase/,
      /密钥|环境配置|REQUIRE_AUTH/,
      /Hobby/,
      /CHANGELOG/,
      /Next\.js source/i,
    ],
  },
  {
    epic: "AI 助手与长期记忆",
    patterns: [
      /\bMCP\b/i,
      /AI 规则|CANONICAL|compare_sources/,
      /白昼|星辰|操作者代号/,
      /长期记忆|AI项目助手|自动拆需求/,
      /DDL|list_tables|describe_table|add_column/,
      /link_item|权限模型|操作日志|studio_links|ai_action/,
      /publish_release/,
      /get_ai_rules/,
      /ChangeSession|协作节奏|要求不清先细问/,
      /关系与日志/,
    ],
  },
  {
    epic: "协作验收与资产决策",
    patterns: [
      /验收|Bug|打回/,
      /资产|资源中心|Assets/,
      /Case Study|作品集 Prompt|模板文档/,
      /评论|测试验收|分享链接/,
      /决策日志|能力地图/,
      /演示沙盘|只读/,
      /PinMark/i,
    ],
  },
  {
    epic: "创造宇宙与作品集体验",
    patterns: [/创造宇宙|作品集|星际|星空|星球桌面|案例页|Starry/i],
  },
  {
    epic: "需求任务与排期",
    patterns: [
      /需求表|需求池|需求看板|需求多视图|需求状态|需求类型/,
      /甘特|看板|日历/,
      /迭代计划|发版时间线|迭代记录|发版|本版更新|Tag 同步/,
      /Side Peek|指派|状态标签|工时/,
      /parent_id|epic\/feature|子需求|requirement_links/,
      /Notion|列宽|拖拽|筛选.*视图|模块树|Excel|板块/,
      /进度排期|任务板|\bpool\b/i,
      /^feat:|^chore:|^fix:|v1\.\d/,
      /有演进按时间|短说明可用 commits|变更原因弱提醒/,
      /^0623$/,
    ],
  },
];

export const EPIC_TO_MODULE: Record<string, string> = {
  灵感捕获与整理: "灵感",
  今日工作台与驾驶舱: "工作台",
  "项目与 Studio 链路": "项目库",
  "Git / 部署与环境配置": "Git",
  "AI 助手与长期记忆": "设置",
  协作验收与资产决策: "资源中心",
  创造宇宙与作品集体验: "资源中心",
  需求任务与排期: "需求任务",
};

export function matchEpicTitle(title: string): string | null {
  for (const rule of EPIC_RULES) {
    if (rule.patterns.some((p) => p.test(title))) return rule.epic;
  }
  return null;
}

export type OrganizeReqTreeResult = {
  reparented: number;
  moduleTagged: number;
  createdEpic: boolean;
  unmatched: string[];
  moduleSync: {
    created: number;
    skippedExisting: number;
    paths: number;
  } | null;
};

async function upsertRowsInChunks(
  rows: Requirement[],
  upsert: (r: Requirement) => Promise<void>,
  chunkSize = 20
) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await Promise.all(chunk.map((r) => upsert(r)));
  }
}

/**
 * 同步板块 → 挂散条到父 epic → 写 module_l1
 * 写入走一次读库 + 批量 upsert，避免逐条 updateRequirement 反复整库拉取。
 */
export async function organizeStarPmRequirementTree(opts?: {
  dry?: boolean;
}): Promise<OrganizeReqTreeResult> {
  const dry = opts?.dry ?? false;
  const {
    createPoolRequirement,
    listProjectModules,
    readDb,
    writeDb,
    getPoolBundle,
    getProjectBundle,
    getProjects,
    createProjectModule,
  } = await import("@/lib/db/local-store");
  const { upsertRequirementRow } = await import("@/lib/db/supabase-store");
  const { isSupabaseConfigured } = await import("@/lib/supabase/config");
  const { getStudioSnapshot } = await import("@/lib/studio/store");
  const { getPmSlugForStudioProject } = await import("@/lib/project-bridge");

  const snap = await getStudioSnapshot();
  const studio = snap.projects.find((p) => p.id === "proj-star-pm");
  if (!studio) throw new Error("找不到 proj-star-pm");

  const featurePaths =
    studio.featureModules?.length > 0
      ? studio.featureModules
      : [...STAR_PM_DEFAULT_MODULES];

  const slug = getPmSlugForStudioProject(studio);
  const keys = [
    slug,
    `studio-${studio.id}`,
    studio.id,
    "a1000001-0001-4001-8001-000000000003",
  ];
  const pmAll = await getProjects();
  const byName = pmAll.find((p) => p.name === studio.title);
  if (byName) keys.push(byName.slug, byName.id);

  const byId = new Map<string, Requirement>();
  let usedKey = slug;
  for (const key of keys) {
    const [pool, board] = await Promise.all([
      getPoolBundle(key).catch(() => null),
      getProjectBundle(key).catch(() => null),
    ]);
    const list = [...(pool?.poolRequirements ?? []), ...(board?.requirements ?? [])];
    if (list.length > 0) {
      usedKey = key;
      for (const r of list) byId.set(r.id, r);
    }
  }
  const seedReqs = [...byId.values()];
  if (seedReqs.length === 0) {
    throw new Error("找不到 Star PM 需求（list 为空）");
  }
  const projectId = seedReqs[0]!.project_id;
  const pm = pmAll.find((p) => p.id === projectId);
  if (!pm) throw new Error(`找不到 PM 项目 id=${projectId} usedKey=${usedKey}`);

  let moduleSync: OrganizeReqTreeResult["moduleSync"] = {
    created: 0,
    skippedExisting: 0,
    paths: featurePaths.length,
  };
  const existingMods = await listProjectModules(pm.id);
  const moduleByName = new Map(
    existingMods.filter((m) => !m.parent_id).map((m) => [m.name, m])
  );
  if (!dry) {
    for (const name of featurePaths) {
      if (moduleByName.has(name)) {
        moduleSync.skippedExisting += 1;
        continue;
      }
      const node = await createProjectModule({ projectId: pm.id, name });
      moduleByName.set(name, node);
      moduleSync.created += 1;
    }
  }

  const db = await readDb();
  let reqs = db.requirements.filter((r) => r.project_id === pm.id);
  const byTitle = new Map(reqs.map((r) => [r.title.trim(), r]));

  const NEED_EPIC = "需求任务与排期";
  let createdEpic = false;
  if (!byTitle.has(NEED_EPIC)) {
    createdEpic = true;
    if (!dry) {
      const created = await createPoolRequirement(pm.id, {
        title: NEED_EPIC,
        type: "epic",
        status_tags: ["已规划"],
        actor_name: AGENT_ACTOR_NAME,
        actor_note: "整理散条时补总需求",
      });
      byTitle.set(NEED_EPIC, created);
      // createPoolRequirement 可能刷新内存；重新取引用
      const refreshed = await readDb();
      Object.assign(db, refreshed);
      reqs = db.requirements.filter((r) => r.project_id === pm!.id);
    }
  }

  const MAIN_EPIC_TITLES = new Set([
    ...EPIC_RULES.map((x) => x.epic),
    NEED_EPIC,
  ]);
  const epicIdByTitle = new Map<string, string>();
  for (const r of reqs) {
    if (!r.parent_id && MAIN_EPIC_TITLES.has(r.title)) {
      epicIdByTitle.set(r.title, r.id);
    }
  }
  const need = reqs.find((r) => r.title === NEED_EPIC);
  if (need) epicIdByTitle.set(NEED_EPIC, need.id);

  let reparented = 0;
  let moduleTagged = 0;
  const unmatched: string[] = [];
  const dirty = new Map<string, Requirement>();
  const now = new Date().toISOString();

  function touch(r: Requirement) {
    r.updated_at = now;
    dirty.set(r.id, r);
  }

  function applyModule(r: Requirement, epicTitle: string | null) {
    if (!epicTitle) return;
    const modName = EPIC_TO_MODULE[epicTitle];
    const mod = modName ? moduleByName.get(modName) : null;
    if (!mod || r.module_l1_id === mod.id) return;
    r.module_l1_id = mod.id;
    touch(r);
    moduleTagged += 1;
  }

  for (const r of reqs) {
    const isKnownEpic = epicIdByTitle.get(r.title) === r.id;
    if (isKnownEpic) {
      applyModule(r, r.title);
      continue;
    }

    if (r.parent_id) {
      const parent = reqs.find((p) => p.id === r.parent_id);
      const epicTitle =
        (parent && epicIdByTitle.has(parent.title) ? parent.title : null) ||
        matchEpicTitle(r.title) ||
        (parent ? matchEpicTitle(parent.title) : null);
      applyModule(r, epicTitle);
      continue;
    }

    const epicTitle = matchEpicTitle(r.title);
    if (!epicTitle) {
      unmatched.push(r.title);
      continue;
    }
    const parentId = epicIdByTitle.get(epicTitle);
    if (!parentId || parentId === r.id) {
      unmatched.push(`${r.title} (缺父 ${epicTitle})`);
      continue;
    }

    const modName = EPIC_TO_MODULE[epicTitle];
    const mod = modName ? moduleByName.get(modName) : null;
    const nextType: RequirementType =
      r.type === "epic" ? "feature" : r.type ?? "feature";

    r.parent_id = parentId;
    r.type = nextType;
    if (mod) r.module_l1_id = mod.id;
    touch(r);
    reparented += 1;
    if (mod) moduleTagged += 1;
  }

  if (!dry && dirty.size > 0) {
    const rows = [...dirty.values()];
    if (isSupabaseConfigured()) {
      await upsertRowsInChunks(rows, upsertRequirementRow, 25);
    } else {
      await writeDb(db);
    }
  }

  return {
    reparented,
    moduleTagged,
    createdEpic,
    unmatched,
    moduleSync,
  };
}
