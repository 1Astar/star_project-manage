const { createClient } = require("@supabase/supabase-js");
const { randomUUID } = require("crypto");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GROUPS = [
  {
    epic: "灵感捕获与整理",
    titles: [
      "GPT Capture 灵感自动入库",
      "整理今日脑暴（AI 聚类+去向）",
      "AI 评估想法竞争力与实现性",
      "Idea 重复检测与合并提醒",
      "AI 自动整理 idea 为结构化卡片",
      "Notion-like Idea 管理系统",
      "Idea Stream 时间线双视图",
      "ChatGPT API Integration Idea",
      "Star PM Idea Parking 灵感停车场",
      "Star PM 项目灵感捕获系统",
      "Star PM AI灵感捕获系统",
    ],
  },
  {
    epic: "创造宇宙与作品集体验",
    titles: [
      "灵感星空图 / 创造宇宙首页",
      "作品集首页改成星球桌面",
      "项目三级展示机制",
      "半立体星际档案馆视觉系统",
      "项目宇宙星图导航系统",
      "Starry Product Lab 桌面式个人作品集 OS",
      "Star PM公开只读作品集模式",
      "Star PM完整产品案例页",
    ],
  },
  {
    epic: "今日工作台与驾驶舱",
    titles: [
      "今日工作台驾驶舱",
      "Star PM 今日主线驾驶舱",
      "Star PM 统一个人项目操作台",
      "项目页灵感与需求同屏",
    ],
  },
  {
    epic: "项目与 Studio 链路",
    titles: [
      "新增 Idea/Project Studio 模块",
      "Star PM Idea与Task分离架构",
      "Star PM Idea转Project完整链路",
      "Star PM 项目生命周期管理",
      "Star PM 项目恢复卡",
      "Star PM 项目版本路线图",
      "Star PM 项目记忆档案",
      "Star PM Creator OS 数据模型",
    ],
  },
  {
    epic: "Git / 部署与环境配置",
    titles: [
      "Monorepo 总仓映射多项目",
      "跨设备全量备份还原",
      "Git 提交推断任务完成",
      "Star PM 接入 Supabase",
      "Star PM GitHub与Vercel项目状态同步",
      "Star PM 项目链接与启动方式统一管理",
      "Star PM 密钥索引与环境配置管理",
    ],
  },
  {
    epic: "AI 助手与长期记忆",
    titles: [
      "Star PM 增加 AI 自动拆需求",
      "Star PM AI长期上下文记忆系统",
      "Star PM AI项目助手",
    ],
  },
  {
    epic: "协作验收与资产决策",
    titles: [
      "项目内评论与测试验收",
      "测试：Notion需求导入Star PM链路",
      "Star PM 能力资产地图",
      "Star PM 创作者个人能力地图",
      "Star PM 决策日志系统",
      "Star PM 项目资源管理 Assets 库",
    ],
  },
];

(async () => {
  const { data: project, error: pe } = await sb
    .from("projects")
    .select("*")
    .eq("slug", "star-pm")
    .single();
  if (pe) throw pe;

  const { data: poolIter } = await sb
    .from("iterations")
    .select("*")
    .eq("project_id", project.id)
    .eq("name", "需求池")
    .maybeSingle();
  let iterationId = poolIter?.id;
  if (!iterationId) {
    iterationId = randomUUID();
    const { error } = await sb.from("iterations").insert({
      id: iterationId,
      project_id: project.id,
      name: "需求池",
      sort_order: -1,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  const { data: reqs, error: re } = await sb
    .from("requirements")
    .select("*")
    .eq("project_id", project.id)
    .eq("in_pool", true);
  if (re) throw re;

  const byTitle = new Map(reqs.map((r) => [r.title.trim(), r]));
  const junk = reqs.filter((r) => r.title === "新功能点" || r.title === "子需求");
  if (junk.length) {
    const { error } = await sb.from("requirements").delete().in(
      "id",
      junk.map((j) => j.id)
    );
    if (error) throw error;
    console.log(
      "deleted junk",
      junk.map((j) => j.title)
    );
  }

  const now = new Date().toISOString();
  const epicRows = [];
  let epicSort = 1;
  for (const g of GROUPS) {
    epicRows.push({
      id: randomUUID(),
      project_id: project.id,
      iteration_id: iterationId,
      module_l1_id: null,
      module_l2_id: null,
      parent_id: null,
      type: "epic",
      title: g.epic,
      sub_function: null,
      detail_work: `汇总域：${g.titles.join("、")}`,
      acceptance_criteria: null,
      priority: "P1",
      status: "pending",
      status_tags: ["待开始"],
      assignees: [],
      req_source: null,
      req_source_note: null,
      inspiration_source: "层级整理",
      next_step: "按子项推进",
      completed_at: null,
      studio_idea_id: null,
      blocker_reason: null,
      sort_order: epicSort++,
      in_pool: true,
      force_closed: false,
      direct_hours: null,
      actual_hours: null,
      product_estimate_hours: null,
      category: null,
      stage_type: null,
      optimization_notes: null,
      known_issues: null,
      submitted_at: now.slice(0, 10),
      due_date: null,
      difficulty_notes: null,
      scenario: null,
      needs_discussion: false,
      prd_link: null,
      prototype_link: null,
      tags: [],
      custom_fields: {},
      created_at: now,
      updated_at: now,
    });
  }

  const { error: epicErr } = await sb.from("requirements").upsert(epicRows);
  if (epicErr) throw epicErr;
  console.log("created epics", epicRows.length);

  const updates = [];
  const matched = new Set();
  for (let i = 0; i < GROUPS.length; i++) {
    const g = GROUPS[i];
    const epicId = epicRows[i].id;
    let childSort = 1;
    for (const title of g.titles) {
      const req = byTitle.get(title);
      if (!req) {
        console.log("MISSING", title);
        continue;
      }
      matched.add(req.id);
      updates.push({
        id: req.id,
        parent_id: epicId,
        type: "task",
        sort_order: childSort++,
        updated_at: now,
      });
    }
  }

  const leftovers = reqs.filter(
    (r) =>
      !matched.has(r.id) &&
      r.title !== "新功能点" &&
      r.title !== "子需求" &&
      !GROUPS.some((g) => g.epic === r.title)
  );
  if (leftovers.length) {
    console.log(
      "leftovers",
      leftovers.map((l) => l.title)
    );
  }

  for (const u of updates) {
    const { error } = await sb
      .from("requirements")
      .update({
        parent_id: u.parent_id,
        type: u.type,
        sort_order: u.sort_order,
        updated_at: u.updated_at,
      })
      .eq("id", u.id);
    if (error) throw error;
  }
  console.log("linked children", updates.length);

  const { data: final } = await sb
    .from("requirements")
    .select("id,title,parent_id,type,sort_order")
    .eq("project_id", project.id)
    .eq("in_pool", true)
    .order("sort_order");
  const epics = final.filter((r) => !r.parent_id);
  for (const e of epics.sort((a, b) => a.sort_order - b.sort_order)) {
    console.log("\n▼", e.type, e.title);
    final
      .filter((c) => c.parent_id === e.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((c) => console.log("   ·", c.type, c.title));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
