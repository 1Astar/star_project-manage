# Star PM 变更记录

版本号：`v大版本.小版本.修改次数` · 分支名：`YYYY-MM-DD-v大版本.小版本.修改次数`

| 段 | 含义 | 何时升 |
|---|---|---|
| 大版本 | 产品定位 / 核心结构方向变化 | 例：从「原型 PM」变为「灵感演进主产品」→ v2.x.x |
| 小版本 | 同方向下新模块或重要能力 | 例：新增 Idea Studio → v1.1.x |
| 修改次数 | 同小版本内的迭代修补 | 每次合入该小版本的改动 +1 |

---

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
