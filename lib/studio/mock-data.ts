import type { Asset, EvolutionLog, Idea, Project, StudioTask } from "@/lib/studio/types";

const T = "2026-07-01T10:00:00.000Z";

export const mockProjects: Project[] = [
  {
    id: "proj-moonpie",
    title: "随心而行",
    positioning: "占问过程中学习传统文化 — 仪式感互动 + 图鉴 + 手札",
    targetUser: "对神秘学、传统文化好奇，想通过轻量仪式获得自我理解的年轻人",
    status: "mainline",
    priority: "P0",
    currentStage: "P1 MVP：塔罗抽牌 + 结果页",
    nextAction: "优化塔罗结果页 UI 层级和文案结构",
    demoUrl: null,
    localRunGuide: "cd E:\\projects\\moonpie\npnpm dev",
    codePath: "E:\\projects\\moonpie",
    relatedPageUrl: "https://app.notion.com/p/Moonpie-395a86f50915810a9bf2da9551d6e782",
    portfolioValue: "作品集核心项目：手势交互 + 文化学习 + 情绪叙事",
    body: {
      initialThought:
        "啊啊啊我想做一个塔罗手势抽牌，还能学小六壬和梅花易数！用摄像头识别手势，抽牌过程要有仪式感。",
      whyThought:
        "单纯塔罗容易撞车，但「学习 + 图鉴 + 手札」有长期价值；手势交互比点按钮更有沉浸感。",
      positioning:
        "随心而行 — 不是算命工具，而是占问过程中学习传统文化的互动体验。先做塔罗 MVP，后续扩展小六壬、梅花易数。",
      iterations:
        "v0.1 手势抽牌链路 → v0.2 结果页优化 → v0.3 牌义图鉴 → v0.4 手札记录",
      done: "抽牌链路跑通（摄像头 + 手势识别 + 牌面展示）",
      notDone:
        "小六壬、梅花易数、中医教学、78 张完整牌义、AI 解读、社交分享",
      nextStep: "优化塔罗结果页：信息层级、文案结构、视觉节奏",
      links:
        "Notion 主页：https://app.notion.com/p/Moonpie-395a86f50915810a9bf2da9551d6e782\n参考看板：https://app.notion.com/p/90c63edbe2ae4997ba6db7b6c7367f8a",
      retrospectives:
        "3/28：定位从「手势塔罗网页」调整为「随心而行」，增加学习维度。\n4/2：结果页被评价「像调试页」，列入 P1。",
    },
    createdAt: "2026-03-15T08:00:00.000Z",
    updatedAt: "2026-07-08T06:00:00.000Z",
  },
  {
    id: "proj-star-pm",
    title: "Star PM",
    positioning: "轻量原型项目管理：原型 → 需求 → 开发 → 测试 → 验收",
    targetUser: "小团队产品经理，需要 Excel 工时表 + 看板 + 分享链接协作",
    status: "active",
    priority: "P1",
    currentStage: "V1 功能完善 + Supabase 持久化",
    nextAction: "接入 Idea/Project Studio 模块（mock 版）",
    demoUrl: "https://star-project-manage.vercel.app",
    localRunGuide: "cd star-pm\nnpm run dev",
    codePath: "E:\\文档\\star\\工具\\private\\工具\\star-pm",
    relatedPageUrl: null,
    portfolioValue: "展示产品全流程管理能力 + 技术全栈",
    body: {
      initialThought: "宠物 App 和 AI 控制器的工时表散落在 Excel，需要一个轻量 PM 工具。",
      whyThought: "团队只有 1 个后端，需要免登录分享链接让协作方更新任务。",
      positioning: "不做 Jira 竞品，专注原型验收场景的小团队工具。",
      iterations: "V0 UI 方向 → V1 看板/甘特/Excel → V1.1 Supabase → V2 Idea Studio",
      done: "看板、分享链接、Supabase、测试验收勾选、评论",
      notDone: "多用户账号体系、AI 自动总结",
      nextStep: "Studio 模块 mock 版上线",
      links: "Vercel: https://star-project-manage.vercel.app",
      retrospectives: "7/8：决定并行 Idea/Project 管理系统，记录灵感演进。",
    },
    createdAt: "2026-06-01T08:00:00.000Z",
    updatedAt: "2026-07-08T06:30:00.000Z",
  },
  {
    id: "proj-ai-pet",
    title: "AI 宠物",
    positioning: "AI 陪伴宠物 App 优化迭代",
    targetUser: "养虚拟宠物的年轻用户",
    status: "active",
    priority: "P1",
    currentStage: "20260610 优化版本开发中",
    nextAction: "推送模块后端评估（40h）",
    demoUrl: null,
    localRunGuide: null,
    codePath: null,
    relatedPageUrl: null,
    portfolioValue: "商业产品实战经验",
    body: {
      initialThought: "优化宠物 App 主页结构、专注横幅、推送模块。",
      whyThought: "公司主线产品，直接影响用户留存。",
      positioning: "AI 宠物 — 情感陪伴 + 专注工具",
      iterations: "主页重构 → 专注横幅 → 推送/勿扰/喝水",
      done: "需求表导入、看板搭建",
      notDone: "推送模块完整链路",
      nextStep: "等待后端排期",
      links: "",
      retrospectives: "",
    },
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z",
  },
  {
    id: "proj-culture-game",
    title: "传统文化游戏化学习",
    positioning: "用游戏机制学诗词、节气、民俗",
    targetUser: "中小学生及家长",
    status: "parking",
    priority: "P2",
    currentStage: "灵感阶段",
    nextAction: "等随心而行 MVP 完成后再评估",
    demoUrl: null,
    localRunGuide: null,
    codePath: null,
    relatedPageUrl: null,
    portfolioValue: "教育 + 文化赛道探索",
    body: {
      initialThought: "把古诗词做成闯关游戏，配合节气主题。",
      whyThought: "和「随心而行」有文化学习交集，但用户群不同。",
      positioning: "待定 — 可能与 Moonpie 合并为「文化学习」子模块",
      iterations: "",
      done: "",
      notDone: "全部",
      nextStep: "停车场观望",
      links: "",
      retrospectives: "7/5：与随心而行定位重叠，暂停车。",
    },
    createdAt: "2026-06-20T08:00:00.000Z",
    updatedAt: "2026-07-05T10:00:00.000Z",
  },
];

export const mockIdeas: Idea[] = [
  {
    id: "idea-001",
    title: "手势神秘学交互产品",
    oneLineIdea: "摄像头手势抽塔罗牌，边玩边学小六壬梅花易数",
    whyItMatters: "仪式感 + 学习双重价值，比纯塔罗有差异化",
    triggerSource: "刷到某个手势交互 demo 视频",
    emotionLevel: "excited",
    type: "product",
    priority: "P1",
    rawInput: "",
    relatedProjectId: "proj-moonpie",
    relatedIdeaId: null,
    subtasks: [],
    status: "converted",
    createdAt: "2026-03-10T14:00:00.000Z",
  },
  {
    id: "idea-002",
    title: "Notion-like Idea 管理系统",
    oneLineIdea: "记录每个想法从灵感到落地的演进，像 Notion 数据库",
    whyItMatters: "想法太多容易丢，需要演进日志而不是普通任务管理",
    triggerSource: "整理 Moonpie Notion 页面时",
    emotionLevel: "excited",
    type: "product",
    priority: "P0",
    rawInput: "",
    relatedProjectId: "proj-star-pm",
    relatedIdeaId: null,
    subtasks: [],
    status: "converted",
    createdAt: "2026-07-08T03:00:00.000Z",
  },
  {
    id: "idea-003",
    title: "宠物专注模式呼吸动画",
    oneLineIdea: "专注时宠物跟着用户呼吸节奏缓慢缩放",
    whyItMatters: "强化陪伴感，和专注横幅形成闭环",
    triggerSource: "自己用专注模式时的感受",
    emotionLevel: "like",
    type: "feature",
    priority: "P2",
    rawInput: "",
    relatedProjectId: "proj-ai-pet",
    relatedIdeaId: null,
    subtasks: [],
    status: "inbox",
    createdAt: "2026-07-07T16:00:00.000Z",
  },
  {
    id: "idea-004",
    title: "塔罗结果页「情绪色温」",
    oneLineIdea: "根据牌面正逆位自动切换页面色温和动效节奏",
    whyItMatters: "现在结果页像调试页，需要情绪叙事",
    triggerSource: "测试随心而行结果页",
    emotionLevel: "like",
    type: "ui",
    priority: "P2",
    rawInput: "",
    relatedProjectId: "proj-moonpie",
    relatedIdeaId: null,
    subtasks: [],
    status: "inbox",
    createdAt: "2026-07-08T05:00:00.000Z",
  },
  {
    id: "idea-005",
    title: "AI 自动整理 idea 为结构化卡片",
    oneLineIdea: "用户随便写一段话，AI 提取标题/类型/下一步/是否转项目",
    whyItMatters: "降低记录门槛，是 Studio 的杀手功能",
    triggerSource: "设计 Studio 时的远期规划",
    emotionLevel: "excited",
    type: "tech",
    priority: "P1",
    rawInput: "",
    relatedProjectId: "proj-star-pm",
    relatedIdeaId: null,
    subtasks: [],
    status: "inbox",
    createdAt: "2026-07-08T06:00:00.000Z",
  },
  {
    id: "idea-006",
    title: "短视频：宠物 AI 的一天",
    oneLineIdea: "用 AI 生成宠物日常 vlog 风格短视频做获客",
    whyItMatters: "低成本内容营销",
    triggerSource: "看到竞品抖音号",
    emotionLevel: "normal",
    type: "content",
    priority: "P3",
    rawInput: "",
    relatedProjectId: null,
    relatedIdeaId: null,
    subtasks: [],
    status: "inbox",
    createdAt: "2026-07-06T10:00:00.000Z",
  },
  {
    id: "idea-007",
    title: "传统文化启蒙小程序",
    oneLineIdea: "节气 + 诗词 + 小游戏，面向家长端",
    whyItMatters: "和随心而行文化线有交集",
    triggerSource: "朋友聊教育创业",
    emotionLevel: "normal",
    type: "business",
    priority: "P3",
    rawInput: "",
    relatedProjectId: "proj-culture-game",
    relatedIdeaId: null,
    subtasks: [],
    status: "parked",
    createdAt: "2026-06-18T09:00:00.000Z",
  },
  {
    id: "idea-008",
    title: "手势识别 fallback 方案",
    oneLineIdea: "摄像头不可用时降级为点击/滑动抽牌",
    whyItMatters: "Safari 和部分安卓机兼容性问题",
    triggerSource: "测试随心而行兼容性",
    emotionLevel: "normal",
    type: "tech",
    priority: "P2",
    rawInput: "",
    relatedProjectId: "proj-moonpie",
    relatedIdeaId: null,
    subtasks: [],
    status: "parked",
    createdAt: "2026-06-25T11:00:00.000Z",
  },
];

export const mockEvolutionLogs: EvolutionLog[] = [
  {
    id: "evo-001",
    title: "定位从手势塔罗调整为随心而行",
    projectId: "proj-moonpie",
    logType: "positioning",
    before: "手势塔罗网页",
    after: "随心而行 — 占问过程中学习传统文化",
    reason: "单纯塔罗容易撞，学习 + 图鉴 + 手札更有长期价值和作品集深度",
    decision: "P1 先做塔罗抽牌和结果页，小六壬/梅花易数停车",
    createdAt: "2026-03-28T10:00:00.000Z",
  },
  {
    id: "evo-002",
    title: "结果页列入 P1 优化",
    projectId: "proj-moonpie",
    logType: "ui_change",
    before: "结果页为调试风格，信息平铺",
    after: "规划分层：牌面 → 解读 → 学习延伸 → 手札入口",
    reason: "自测和反馈都认为「像调试页」",
    decision: "下一步：优化 UI 层级和文案结构",
    createdAt: "2026-04-02T15:00:00.000Z",
  },
  {
    id: "evo-003",
    title: "抽牌链路跑通",
    projectId: "proj-moonpie",
    logType: "stage_review",
    before: "仅有静态原型",
    after: "摄像头手势识别 + 抽牌动画 + 基础结果展示",
    reason: "MVP 第一步验证技术可行性",
    decision: "进入结果页优化阶段",
    createdAt: "2026-06-15T09:00:00.000Z",
  },
  {
    id: "evo-004",
    title: "Star PM 接入 Supabase",
    projectId: "proj-star-pm",
    logType: "tech_decision",
    before: "本地 JSON 文件存储",
    after: "Supabase PostgreSQL 持久化",
    reason: "Vercel 部署需要云数据库，团队需共享数据",
    decision: "本地开发也走 Supabase，保留 seed 降级",
    createdAt: "2026-07-07T14:00:00.000Z",
  },
  {
    id: "evo-005",
    title: "新增 Idea/Project Studio 模块",
    projectId: "proj-star-pm",
    logType: "feature_add",
    before: "仅需求看板 + 工时管理",
    after: "并行 Idea 收件箱 + 演进记录 + Notion-like 项目页",
    reason: "需要记录灵感演进，不只是任务管理",
    decision: "先做 mock 版，不接数据库",
    createdAt: T,
  },
  {
    id: "evo-006",
    title: "文化游戏化学习停车",
    projectId: "proj-culture-game",
    logType: "feature_cut",
    before: "独立项目推进",
    after: "停车场观望，可能合并到随心而行",
    reason: "和 Moonpie 文化学习线重叠，精力不够双线",
    decision: "等 P0 完成后再评估",
    createdAt: "2026-07-05T10:00:00.000Z",
  },
];

export const mockTasks: StudioTask[] = [
  {
    id: "task-001",
    title: "优化塔罗结果页 UI 层级",
    projectId: "proj-moonpie",
    status: "in_progress",
    priority: "P0",
    workload: "2d",
    blocker: null,
    dueDate: "2026-07-12",
  },
  {
    id: "task-002",
    title: "结果页文案结构梳理",
    projectId: "proj-moonpie",
    status: "todo",
    priority: "P0",
    workload: "0.5d",
    blocker: null,
    dueDate: "2026-07-10",
  },
  {
    id: "task-003",
    title: "Studio mock 页面搭建",
    projectId: "proj-star-pm",
    status: "in_progress",
    priority: "P1",
    workload: "1d",
    blocker: null,
    dueDate: "2026-07-08",
  },
  {
    id: "task-004",
    title: "推送模块后端评估对齐",
    projectId: "proj-ai-pet",
    status: "todo",
    priority: "P1",
    workload: "0.5d",
    blocker: "等待后端排期",
    dueDate: "2026-07-15",
  },
  {
    id: "task-005",
    title: "手势识别 Safari 兼容测试",
    projectId: "proj-moonpie",
    status: "paused",
    priority: "P2",
    workload: "1d",
    blocker: "结果页优先",
    dueDate: null,
  },
];

export const mockAssets: Asset[] = [
  {
    id: "asset-001",
    title: "Moonpie Notion 主页",
    projectId: "proj-moonpie",
    assetType: "inspiration",
    url: "https://app.notion.com/p/Moonpie-395a86f50915810a9bf2da9551d6e782",
    note: "项目全貌、演进记录参考",
    takeaway: "属性区 + 正文模板结构",
    risk: null,
  },
  {
    id: "asset-002",
    title: "Idea 管理 Notion 看板",
    projectId: "proj-star-pm",
    assetType: "inspiration",
    url: "https://app.notion.com/p/90c63edbe2ae4997ba6db7b6c7367f8a?v=fe41ca1bb0b5462a93af68d7fe7bd45a",
    note: "Studio 模块 UI/字段参考",
    takeaway: "数据库视图 + 关联字段设计",
    risk: null,
  },
  {
    id: "asset-003",
    title: "Co-Star App",
    projectId: "proj-moonpie",
    assetType: "competitor",
    url: "https://www.costarastrology.com",
    note: "星座运势类竞品",
    takeaway: "每日推送 + 社交分享机制",
    risk: "定位不同，勿照搬 UI",
  },
  {
    id: "asset-004",
    title: "手势识别 MediaPipe 文档",
    projectId: "proj-moonpie",
    assetType: "tech_doc",
    url: "https://developers.google.com/mediapipe",
    note: "当前抽牌手势方案依赖",
    takeaway: "Hand Landmarker 模型",
    risk: "移动端性能需实测",
  },
  {
    id: "asset-005",
    title: "专注模式 UI 参考",
    projectId: "proj-ai-pet",
    assetType: "ui_ref",
    url: "https://dribbble.com/tags/focus_timer",
    note: "宠物专注横幅视觉参考",
    takeaway: "柔和色温 + 微动效",
    risk: null,
  },
];

export function getStudioSeedData() {
  return {
    projects: mockProjects,
    ideas: mockIdeas,
    evolutionLogs: mockEvolutionLogs,
    tasks: mockTasks,
    assets: mockAssets,
  };
}

export function getStudioData() {
  return {
    projects: mockProjects,
    ideas: mockIdeas,
    evolutionLogs: mockEvolutionLogs,
    tasks: mockTasks,
    assets: mockAssets,
  };
}

export function getProjectById(id: string) {
  return mockProjects.find((p) => p.id === id) ?? null;
}

export function getIdeasByStatus(status: Idea["status"]) {
  return mockIdeas.filter((i) => i.status === status);
}

export function getProjectIdeas(projectId: string) {
  return mockIdeas.filter((i) => i.relatedProjectId === projectId);
}

export function getProjectTasks(projectId: string) {
  return mockTasks.filter((t) => t.projectId === projectId);
}

export function getProjectAssets(projectId: string) {
  return mockAssets.filter((a) => a.projectId === projectId);
}

export function getProjectEvolution(projectId: string) {
  return mockEvolutionLogs
    .filter((e) => e.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getMainlineProject() {
  return mockProjects.find((p) => p.status === "mainline") ?? null;
}

export function getTodayFocus() {
  const mainline = getMainlineProject();
  if (!mainline) return null;
  const task = mockTasks.find(
    (t) => t.projectId === mainline.id && t.status === "in_progress"
  );
  return {
    project: mainline,
    task: task ?? mockTasks.find((t) => t.projectId === mainline.id) ?? null,
  };
}

export function getRecentIdeas(limit = 5) {
  return [...mockIdeas]
    .filter((i) => i.status === "inbox")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function getRecentEvolution(limit = 5) {
  return [...mockEvolutionLogs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function getParkedIdeas() {
  return mockIdeas.filter((i) => i.status === "parked");
}

export function getParkedProjects() {
  return mockProjects.filter((p) => p.status === "parking");
}

export function projectTitle(id: string) {
  return mockProjects.find((p) => p.id === id)?.title ?? "未知项目";
}
