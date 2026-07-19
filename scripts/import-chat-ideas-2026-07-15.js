/**
 * 从 2026-07-14~15 Cursor 会话整理 Idea，并回写相关需求完成态
 * 运行: node --env-file=.env.local scripts/import-chat-ideas-2026-07-15.js
 */
const { createClient } = require("@supabase/supabase-js");
const { randomUUID } = require("crypto");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROJECT = "proj-star-pm";
const SOURCE_CHAT = "Cursor · Star PM 需求体验与层级 2026-07-14~15";
const SOURCE_METHOD = "Cursor聊天整理";

/** @type {Array<object>} */
const IDEAS = [
  {
    title: "灵感 = 需求：统一实体「需求（灵感）」",
    type: "product",
    priority: "P0",
    status: "done",
    occurred_at: "2026-07-14T15:32:00+08:00",
    completed_at: "2026-07-14T16:00:00+08:00",
    chat_topic: "灵感一键落入需求池 / 合并实体",
    raw_input:
      "其实灵感点就是个需求池呀。灵感和需求应该是同一个东西的，没啥区别。合并成一个实体；产品侧统一叫「需求」，括号备注「灵感」。",
    one_line_idea: "项目内不再区分灵感与需求表，统一为需求（灵感）池。",
    why_it_matters: "消灭双轨心智负担，项目页直达工作对象。",
    ai_supplement:
      "落地方案：同一 requirements 实体；收件箱灵感可仍作探索入口，但落入项目后即需求。status 改为可自建标签；完成标签写 completed_at。",
    suggested_next_step: "持续收敛文案与旧「灵感池入口」残余。",
    decision_notes: "已决策并实现：灵感=需求合并。",
    related_module: "需求池",
    match_req_titles: ["Star PM Idea与Task分离架构", "灵感捕获与整理"],
  },
  {
    title: "状态用可自建文字标签；指派多选；评审也是状态",
    type: "feature",
    priority: "P0",
    status: "done",
    occurred_at: "2026-07-14T15:52:00+08:00",
    completed_at: "2026-07-14T16:30:00+08:00",
    chat_topic: "合并实体后的状态/指派规则",
    raw_input:
      "status可以自主添加吧，自己输入文字就形成一个标签；需求指派可以多选；评审可以做状态吧。",
    one_line_idea: "status_tags[] 自由标签 + assignees[] 多选。",
    why_it_matters: "适配真实协作状态机，不必改枚举才能加「评审」。",
    ai_supplement:
      "机读 status 由标签推导；「完成」写入 completed_at；看板列按标准标签归类。",
    suggested_next_step: "统一默认标签包与看板列映射文档。",
    decision_notes: "已实现。",
    related_module: "需求池",
    match_req_titles: [],
  },
  {
    title: "Notion 式需求表：左右滑动 + Side Peek + 全屏详情",
    type: "ui",
    priority: "P0",
    status: "done",
    occurred_at: "2026-07-14T16:24:00+08:00",
    completed_at: "2026-07-15T11:53:00+08:00",
    chat_topic: "灵感池没有 Notion 内容/左右拉；详情怎么打开",
    raw_input:
      "为什么灵感池只有单独的灵感没有像 Notion 这样的内容然后能够左右拉？需求详情放在标题旁边或点这一条会出现。后来纠正：要点标题旁边「打开」才开 Side Peek。",
    one_line_idea: "多列表格 + Side Peek，显式「打开」进入详情。",
    why_it_matters: "把需求当工作对象而不是列表文案。",
    ai_supplement:
      "不做全量 Notion 公式/rollup；Peek 支持状态标签、指派、附件、Memory Timeline；行内可改部分字段。",
    suggested_next_step: "Peek 内补链编辑器（手工加 relation）。",
    decision_notes: "已实现；2026-07-15 改为仅「打开」触发 Peek。",
    related_module: "需求表",
    match_req_titles: ["Notion-like Idea 管理系统"],
  },
  {
    title: "需求多视图：看板 / 日历 / 甘特（不做公式 rollup）",
    type: "feature",
    priority: "P1",
    status: "done",
    occurred_at: "2026-07-14T16:44:00+08:00",
    completed_at: "2026-07-14T18:00:00+08:00",
    chat_topic: "多种视图 vs 复刻 Notion",
    raw_input:
      "多种视图（看板/日历/甘特）。完全复刻 Notion（拖拽列、公式、关联 rollup）——过度设计。",
    one_line_idea: "需求侧四视图够用，禁止公式级复杂度。",
    why_it_matters: "先闭环规划可视化，避免工程沉没。",
    ai_supplement:
      "看板默认叶子；甘特父子都显示且父汇总日期；明确不做列公式/rollup。",
    suggested_next_step: "甘特与工时汇总条可视化增强。",
    decision_notes: "已实现。",
    related_module: "需求视图",
    match_req_titles: [],
  },
  {
    title: "Git 作用域：用项目 branch + code_path，不再默认 main",
    type: "tech",
    priority: "P1",
    status: "done",
    occurred_at: "2026-07-14T16:44:00+08:00",
    completed_at: "2026-07-14T18:00:00+08:00",
    chat_topic: "git 推断任务完成的准确性",
    raw_input:
      "task-git / project-git 改用项目的 branch + code_path，不再写死 main；commit 匹配只在影响本目录的提交里找。",
    one_line_idea: "按真实分支与代码路径过滤 commit。",
    why_it_matters: "避免误把无关提交当成完成证据。",
    ai_supplement: "resolveProjectGitScope；无默认 main。",
    suggested_next_step: "各 Studio 项目补齐 branch/codePath。",
    decision_notes: "已实现。",
    related_module: "Git",
    match_req_titles: ["Git 提交推断任务完成", "Star PM GitHub与Vercel项目状态同步"],
  },
  {
    title: "未映射 Studio 项目自动挂接 PM 需求池",
    type: "feature",
    priority: "P0",
    status: "done",
    occurred_at: "2026-07-15T09:39:00+08:00",
    completed_at: "2026-07-15T09:46:00+08:00",
    chat_topic: "为什么别的项目需求表不齐全 / 随心而行",
    raw_input: "别的项目（如随心而行）只有底下 Studio 任务，需求表整块没有。",
    one_line_idea: "ensurePmProjectForStudio：未硬编码映射也创建 PM 项目+需求池。",
    why_it_matters: "人人多项目，映射表不能成为准入门槛。",
    ai_supplement: "slug=studio-{id}；resolveProjectRoute 幂等挂接。",
    suggested_next_step: "项目库列表展示自动挂接项目。",
    decision_notes: "已实现。",
    related_module: "项目桥接",
    match_req_titles: [],
  },
  {
    title: "Studio 任务收成独立 Tab",
    type: "ui",
    priority: "P2",
    status: "done",
    occurred_at: "2026-07-15T09:39:00+08:00",
    completed_at: "2026-07-15T09:46:00+08:00",
    chat_topic: "需求表体验补齐",
    raw_input: "Studio 任务应单独 Tab，不要挤在页底重复一块。",
    one_line_idea: "view=studio 页签「Studio 任务」。",
    why_it_matters: "主视图聚焦需求，拆分执行入口清晰。",
    ai_supplement: "仅有 Studio 上下文时显示该 Tab。",
    suggested_next_step: "无。",
    decision_notes: "已实现。",
    related_module: "任务页",
    match_req_titles: [],
  },
  {
    title: "需求表交互：排序筛选列显隐拖行行内编辑多选删除",
    type: "feature",
    priority: "P0",
    status: "done",
    occurred_at: "2026-07-15T09:39:00+08:00",
    completed_at: "2026-07-15T11:50:00+08:00",
    chat_topic: "顶部不能筛选排序 / 不能点改 / 列显隐 / 拖拽 / 重复清理",
    raw_input:
      "顶部不能筛选排序；不能直接点改；列显隐；表格拖拽；后面出现很多重复要多选删除；行列都应能拖。",
    one_line_idea: "把「需求表缺口」当 bug 债还清。",
    why_it_matters: "没有表交互就无法当真工作台。",
    ai_supplement:
      "localStorage 列偏好；拖行改 sort_order；表头拖列序；清理同灵感重复 + unique index。",
    suggested_next_step: "批量改状态/指派。",
    decision_notes: "已实现；曾清理 287 条重复。",
    related_module: "需求表",
    match_req_titles: [],
  },
  {
    title: "子需求多层树：parent_id + epic/feature/task + 叶子工时汇总",
    type: "product",
    priority: "P0",
    status: "done",
    occurred_at: "2026-07-15T10:02:00+08:00",
    completed_at: "2026-07-15T11:00:00+08:00",
    chat_topic: "子需求层级架构",
    raw_input:
      "允许多层树，UI 默认强调 2 层；同一张 requirements + parent_id；看板只叶子；甘特父子都显示；父状态自动算；工时=叶子 SUM + direct_hours；并加 type。",
    one_line_idea: "需求即树，父是容器也可带 direct_hours。",
    why_it_matters: "模块→功能→任务天然长树，没有层级就只能平铺堆灵感。",
    ai_supplement:
      "父完成规则 + 强制关闭→已取消；默认展开深度 2；2026-07-15 已把 Star PM 池整理成 7 Epic。",
    suggested_next_step: "支持拖到父节点下改变层级（现仅同级行序）。",
    decision_notes: "已实现数据模型与 UI。",
    related_module: "需求树",
    match_req_titles: ["Star PM 增加 AI 自动拆需求"],
  },
  {
    title: "requirement_links + Idea→需求→任务→Evolution 时间线",
    type: "product",
    priority: "P1",
    status: "done",
    occurred_at: "2026-07-15T10:08:00+08:00",
    completed_at: "2026-07-15T11:00:00+08:00",
    chat_topic: "Memory Timeline / requirement_links",
    raw_input:
      "加 requirement_links；支持 inspired_by 等；做 Idea→Requirement→Task→Evolution 时间线 UI。",
    one_line_idea: "关联边表 + Peek 内 Memory Timeline。",
    why_it_matters: "作品集与决策要叙事链，不能只有孤岛需求。",
    ai_supplement:
      "relation: inspired_by/from_idea/has_task/has_evolution；Asset/Decision 全站页暂不做。",
    suggested_next_step: "独立 Memory Timeline 页；手工加链 UI。",
    decision_notes: "基础表+Peek 时间线已落地。",
    related_module: "Memory",
    match_req_titles: ["Star PM AI长期上下文记忆系统", "Star PM 项目记忆档案"],
  },
  {
    title: "点进项目直接是需求池，而不是藏入口小按钮",
    type: "ui",
    priority: "P1",
    status: "done",
    occurred_at: "2026-07-14T13:45:00+08:00",
    completed_at: "2026-07-14T16:00:00+08:00",
    chat_topic: "灵感点就是需求池",
    raw_input: "为啥点进去项目里去不是直接的需求池，还只是一个小按钮才能进需求池？",
    one_line_idea: "项目→需求与任务主路径即需求表。",
    why_it_matters: "主工作入口必须可见。",
    ai_supplement: "任务页默认 view=pool。",
    suggested_next_step: "核对侧栏命名一致性。",
    decision_notes: "已调整信息架构。",
    related_module: "导航",
    match_req_titles: ["项目页灵感与需求同屏"],
  },
  {
    title: "今日统计数字（如 +32）可点进明细且可交互",
    type: "feature",
    priority: "P2",
    status: "done",
    occurred_at: "2026-07-14T10:35:00+08:00",
    completed_at: "2026-07-14T10:50:00+08:00",
    chat_topic: "今日工作台交互",
    raw_input: "今日的 +32 能不能点进去看具体的，每个都能交互吧。",
    one_line_idea: "概览数字可下钻。",
    why_it_matters: "概览不能是死数据。",
    ai_supplement: "与今日驾驶舱一并验收。",
    suggested_next_step: "核对所有概览计数是否均可下钻。",
    decision_notes: "会话中已做。",
    related_module: "今日工作台",
    match_req_titles: ["今日工作台驾驶舱", "Star PM 今日主线驾驶舱"],
  },
  {
    title: "灵感集应像项目一样可改",
    type: "feature",
    priority: "P2",
    status: "done",
    occurred_at: "2026-07-14T10:27:00+08:00",
    completed_at: "2026-07-14T10:40:00+08:00",
    chat_topic: "灵感表不可编辑",
    raw_input: "灵感集应该像项目一样可改。",
    one_line_idea: "灵感实体字段可写回。",
    why_it_matters: "只读灵感池无法当作生产工具。",
    ai_supplement: "与项目恢复卡/资料链接信息结构调整同期。",
    suggested_next_step: "无。",
    decision_notes: "已处理编辑能力。",
    related_module: "灵感",
    match_req_titles: [],
  },
];

function iso(s) {
  return new Date(s).toISOString();
}

(async () => {
  const { data: existing, error: le } = await sb
    .from("studio_ideas")
    .select("id,title,status,ai_supplement,chat_topic,decision_notes,completed_at,occurred_at")
    .eq("related_project_id", PROJECT);
  if (le) throw le;
  const byTitle = new Map((existing || []).map((i) => [i.title.trim(), i]));

  let created = 0;
  let updatedIdeas = 0;

  for (const idea of IDEAS) {
    const hit = byTitle.get(idea.title);
    const payload = {
      title: idea.title,
      type: idea.type,
      priority: idea.priority,
      status: idea.status,
      related_project_id: PROJECT,
      one_line_idea: idea.one_line_idea,
      why_it_matters: idea.why_it_matters,
      raw_input: idea.raw_input,
      ai_supplement: idea.ai_supplement,
      chat_topic: idea.chat_topic,
      source_chat: SOURCE_CHAT,
      source_method: SOURCE_METHOD,
      trigger_source: SOURCE_CHAT,
      suggested_next_step: idea.suggested_next_step,
      decision_notes: idea.decision_notes,
      related_module: idea.related_module,
      emotion_level: "喜欢",
      occurred_at: iso(idea.occurred_at),
      completed_at: idea.completed_at ? iso(idea.completed_at) : null,
      updated_at: new Date().toISOString(),
    };

    if (hit) {
      const { error } = await sb.from("studio_ideas").update(payload).eq("id", hit.id);
      if (error) throw error;
      updatedIdeas += 1;
      console.log("update idea", idea.title);
    } else {
      const row = {
        id: `idea-${randomUUID().slice(0, 8)}`,
        ...payload,
        created_at: iso(idea.occurred_at),
        subtasks: [],
        github_labels: [],
      };
      const { error } = await sb.from("studio_ideas").insert(row);
      if (error) throw error;
      created += 1;
      console.log("create idea", idea.title);
    }
  }

  // Mark related requirements completed when idea is done
  const { data: proj } = await sb.from("projects").select("id").eq("slug", "star-pm").single();
  let reqUpdated = 0;
  for (const idea of IDEAS) {
    if (idea.status !== "done" || !idea.match_req_titles?.length) continue;
    for (const title of idea.match_req_titles) {
      const { data: rows } = await sb
        .from("requirements")
        .select("id,status_tags,completed_at,submitted_at")
        .eq("project_id", proj.id)
        .eq("in_pool", true)
        .eq("title", title);
      for (const r of rows || []) {
        const tags = Array.isArray(r.status_tags) ? r.status_tags : [];
        const nextTags = tags.includes("完成") ? tags : ["完成", ...tags.filter((t) => t !== "待开始")];
        const { error } = await sb
          .from("requirements")
          .update({
            status_tags: nextTags,
            status: "done",
            completed_at: r.completed_at || iso(idea.completed_at || idea.occurred_at),
            submitted_at: r.submitted_at || iso(idea.occurred_at).slice(0, 10),
            next_step: idea.suggested_next_step || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", r.id);
        if (error) throw error;
        reqUpdated += 1;
        console.log("req done", title);
      }
    }
  }

  // Mark tree epics with submitted_at = organize day if empty
  const epicTitles = [
    "灵感捕获与整理",
    "创造宇宙与作品集体验",
    "今日工作台与驾驶舱",
    "项目与 Studio 链路",
    "Git / 部署与环境配置",
    "AI 助手与长期记忆",
    "协作验收与资产决策",
  ];
  for (const title of epicTitles) {
    await sb
      .from("requirements")
      .update({
        submitted_at: "2026-07-15",
        inspiration_source: "层级整理",
        next_step: "按子项推进；已落地能力见同会话 Idea 档案",
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", proj.id)
      .eq("title", title);
  }

  console.log({ created, updatedIdeas, reqUpdated });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
