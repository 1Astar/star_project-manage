# Star PM 变更记录

版本号：`v大版本.小版本.修改次数` · 分支名：`YYYY-MM-DD-v大版本.小版本.修改次数`

| 段 | 含义 | 何时升 |
|---|---|---|
| 大版本 | 产品定位 / 核心结构方向变化 | 例：从「原型 PM」变为「灵感演进主产品」→ v2.x.x |
| 小版本 | 同方向下新模块或重要能力 | 例：新增 Idea Studio → v1.1.x |
| 修改次数 | 同小版本内的迭代修补 | 每次合入该小版本的改动 +1 |

---

## v1.3.2 · 2026-07-13

- **每日 Git 同步 Cron**：新增 `/api/cron/sync-git`，每天 11:00 自动拉取所有已绑定 `repo_full_name` + `repo_branch` 的项目的最近 commit

## v1.3.1 · 2026-07-09

- **修复 Vercel 部署失败**：`sync-ideas` Cron 从每 15 分钟改为每日 10:00（Hobby 套餐仅支持每日 Cron）；收件箱仍可手动同步

## v1.3.0 · 2026-07-09

- **信息架构统一**：Star PM 与 Idea Studio 合并为一套「个人项目操作台」导航（今日工作台 / 项目库 / 灵感收件箱 / 我的待办 / 演进记录 / 资料·链接 / 密钥索引 / 设置）
- **项目详情 6 Tab**：项目恢复 · 需求与任务 · 原型与验收 · 进度排期 · 迭代记录 · 资料链接；Excel 导入与项目设置收入「更多操作」
- **今日工作台驾驶舱**：今日焦点 / 主线 / 待处理提醒 + 项目库卡片 + 最近灵感 / 演进 / Git 更新
- **视觉统一**：背景 `#F7F8FA`、靛蓝主色、12px 圆角；旧 `/studio/*` 路由重定向至新路径
- 顶栏 **「退出」改为「返回」**（按层级回到项目恢复 / 项目库 / 工作台）

## v1.2.2 · 2026-07-09

- 灵感收件箱 / 停车场新增 **「转成项目」** 按钮（调用已有 `POST /api/studio/ideas/[id]/convert`）
- 一键：创建 Project · 初始演进记录 · 状态改 converted · 回填 relatedProjectId

## v1.2.1 · 2026-07-09

- Studio 首页顶部 **「+ 捕捉一个想法」** 弹窗：原始想法 / 为什么 / 关联项目 / 情绪 / 停车场
- AI 评估 **实现性 + 竞争力**（1–5 分）并拆解需求任务，可同步写入项目任务列表
- 项目详情 **需求任务板**：优先级、手动完成、Git commit 检测、进度备注（`010_studio_task_progress.sql`）

## v1.2.0 · 2026-07-09

- **AI 灵感收件箱 + GitHub Issue 中转**：`POST /api/ideas/capture` 创建 Issue，不直接写库
- **定时/手动同步**：`GET /api/github/sync-ideas`、`POST /api/studio/ideas/sync`、`/api/cron/sync-ideas`
- 收件箱新增 **AI Capture 模板**（结构化粘贴 + 同步按钮）
- Idea 转 Project 时自动写入 **演进记录**（初始想法）
- **项目恢复卡**扩展：GitHub / Vercel / 最近 Git 更新 / 暂时不做

## v1.1.5 · 2026-07-09

- 修复 Vercel 构建：恢复**需求池**相关 actions / db / types 导出（`fetchPoolData`、`ensurePoolIteration` 等）
- 合并 pool 页面与组件；Supabase 读取补 `project_members`、`pool_column_defs`

## v1.1.4 · 2026-07-09

- OpenAI 配置改为**网页自主配置**：`/studio/inbox` 内展开「OpenAI 配置」
- API Key / 模型保存在浏览器 **localStorage**（`star-pm:openai-settings:v1`），不再依赖 Vercel 环境变量
- AI 拆解请求由前端携带 Key，服务端仅转发 OpenAI，不落库

## v1.1.3 · 2026-07-09

- 灵感收件箱：**发送灵感 · AI 拆解优先级**（OpenAI 结构化 JSON）
- 可选关联**项目**或**已有灵感**；AI 定 P0–P3 并拆 2–8 条子任务
- 关联项目时可勾选将子任务同步写入 `studio_tasks`
- Supabase：`008_studio_idea_ai.sql`（priority / raw_input / related_idea_id / subtasks）
- API：`POST /api/studio/ideas/analyze`

## v1.1.2 · 2026-07-09

- 全站展示版本号 `v1.1.2 · 2026-07-09` 与版权 **© 刘星雨 Starry Product Lab**
- Star PM 顶栏、页脚；Idea Studio 侧栏与移动端页脚；登录页

## v1.1.1 · 2026-07-08

**Idea / Project Studio 首次可交付（小版本 1，第 1 次修改）**

- 新增 `/studio`：Dashboard、当前主线、灵感收件箱、项目库、项目详情、演进记录、灵感停车场
- Notion-like 项目详情：属性区 + 正文模板（初始想法 → 复盘）+ 恢复卡
- Supabase 持久化：`studio_projects` / `studio_ideas` / `studio_evolution_logs` / `studio_tasks` / `studio_assets`（`007_studio.sql`）
- Studio 增删改 API：projects / ideas / evolution / tasks / assets
- 灵感停车、灵感转项目（`POST /api/studio/ideas/[id]/convert`）
- Notion 导入：`POST /api/studio/import/notion`，Dashboard 一键预览 / 导入并保存
- Star PM 主项目 Git 同步：`GET /api/github/sync`，项目详情展示最近 commit

## v1.0.0 · 2026-07-06

**Star PM V1 基线**

- 原型 → 需求 → 开发 → 测试 → 验收 轻量 PM
- 看板、甘特、工时、Excel 导入导出、分享链接、Supabase 主库
