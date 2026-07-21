# Star PM 变更记录

版本号：`v大版本.小版本.修改次数` · 分支名：`YYYY-MM-DD-v大版本.小版本.修改次数`

| 段 | 含义 | 何时升 |
|---|---|---|
| 大版本 | 产品定位 / 核心结构方向变化 | 例：从「原型 PM」变为「灵感演进主产品」→ v2.x.x |
| 小版本 | 同方向下新模块或重要能力 | 例：新增 Idea Studio → v1.1.x |
| 修改次数 | 同小版本内的迭代修补 | 每次合入该小版本的改动 +1 |

---

## v1.10.8 · 2026-07-21

- **本版更新内容**：每条变更显示方向标签（产品 / 体验 / 技术 / 交付），有演进时按时间倒序；commits 补全也按提交时间排序

## v1.10.7 · 2026-07-21

- **同步版本 / 板块**：发版说明无 `- ` 列表时也会拆条导入演进并推断板块；短说明可再用 commits 补全
- **发版卡片**：尚无挂版演进时，直接从本版说明文案推断板块徽章（避免「有更新内容却显示未关联板块」）

## v1.10.6 · 2026-07-21

- **需求详情侧栏**：基本信息补指派/来源/工时/截止日期；「归属 / Bug」展示项目·计划·模块，可一键提 Bug 并列出关联 Bug
- **Bug 详情**：归属区显示项目与关联需求（可跳转）；从需求带 `?new=1&req=` 打开提 Bug 表单并预填

## v1.10.5 · 2026-07-21

- **Bug 左右布局**：提 Bug / 详情与禅道类似（左重现步骤·描述，右基本信息）
- **字段**：严重程度 1–4、Bug 类型；支持指派、关联需求；列表可点进详情
- **迁移**：需执行 `029_bug_severity_type.sql`（`bugs.severity` / `bugs.bug_type`）

## v1.10.4 · 2026-07-21

- **需求详情**：整页左右布局（左正文 / 右基本信息·角色任务·测试核对·验收·讨论），压紧留白，一屏可操作

## v1.10.3 · 2026-07-21

- **管理员密钥区**：登录后可直接进入 `/keys` 与项目密钥，不再二次输密码
- **观看者门禁**：仍禁止密钥索引、项目密钥及相关 API
- **生产库**：补齐 `studio_projects.parent_id`；确认 `feature_modules` 可读写；「应用到未绑定」只 patch 仓库字段

## v1.10.2 · 2026-07-21

- **缺列提示**：feature_modules / schema cache 错误改为中文，引导执行迁移 028
- **迁移 028**：补全 `studio_ideas.related_module`（与线上一致）

## v1.10.1 · 2026-07-21

- **需求总览**：侧栏新入口 `/boards/requirements`，跨项目需求看板（卡片带项目名，可筛选 / 隐藏已完成，拖拽改状态）
- **我的待办**：顶栏增加「需求总览」链接

## v1.10.0 · 2026-07-21

- **观看者角色**：`VIEWER_USERNAME` / `VIEWER_PASSWORD`；可协作日常页面，侧栏隐藏「密钥索引」
- **密钥区门禁**：观看者禁止 `/keys`、项目密钥与相关 API；管理员登录后可直接进入（v1.10.3 起取消二次密码）
- **设置**：观看者不可见备份还原 / Git 默认仓

## v1.9.9 · 2026-07-21

- **需求池表格**：「大型模块 / 功能 / 任务」从名称列拆出为独立「类型」列；点「列」可显隐；名称列不再挤徽章

## v1.9.8 · 2026-07-21

- **我的待办 · 进行中任务**：展示所属项目 + 需求标题；可点击进入需求详情（待测试等状态优先靠前）

## v1.9.7 · 2026-07-21

- **作品集 Prompt**：从各项目「项目恢复」移除，只保留在全局资产库 / 模板

## v1.9.6 · 2026-07-21

- **同步版本**：只在语义化 Tag 相邻之间用 commits 补「本版变更」（忽略 stage/nest 过程 Tag）
- **功能板块**：Chris Phone 等按产品功能面（对话/相册/推送…），不再默认「产品/体验/技术/交付」
- **推断**：变更说明导入演进时按功能关键词打板块；代码仓库设置可编辑功能板块名单

## v1.9.5 · 2026-07-21

- **按钮可读性**：Tab / Chip / 次按钮改为浅底深字；`!important` + 内联 style + `-webkit-text-fill-color`，避免深蓝底看不见字
- **项目导航 / 迭代记录**：选中态不再使用深蓝底白字
- **概况页**：仿禅道紧凑两列；模块树可增删改（一级 + 子模块）
- **关键词推断板块**：灵感 / Notion / 演进写入缺板块时按条目推断
- **版本需求导入**：「同步版本」后把各版 Release 说明条目导入为演进

## v1.9.3 · 2026-07-20

- **发版时间线**：默认只展示语义化版本 Tag（如 `v1.2.3`）；`stage/`、`nest/` 等过程 Tag 折叠在「过程 Tag」
- **资源中心 / 关联版本下拉**：语义化与过程 Tag 分组

## v1.9.2 · 2026-07-20

- **统一 AI 规则**：`docs/ai/CANONICAL_RULES.md` + `AGENTS.md` / `.cursor/rules/star-pm-ai.mdc` 指针
- **MCP**：`get_ai_rules`、`compare_sources`（Git / Vercel / Studio 谁最新）
- **导入校验**：缺板块标记「待补齐·板块」仍可导入；Notion 导入返回 `pendingModuleFill`
- **capture_idea**：关联项目但无板块时同样标记待补齐

## v1.9.1 · 2026-07-20

- **Tag 同步增强**：无 Release body 时用相邻 Tag 的 commits 生成「本版变更」；补 Tag 发布时间
- **发版时间线**：展示本版更新内容 + 板块徽章；无板块时弱提示
- **MCP**：`capture_idea` / `add_evolution` / `add_decision` 强化板块字段；缺板块返回 warning
- **发版**：新 MCP `publish_release` + `POST .../releases/publish` — 按板块汇总演进并创建 GitHub Release，未挂版本演进可挂到本 tag

## v1.9.0 · 2026-07-20

- **迭代记录升级**：`/projects/[id]/evolution` 多 tab — 项目发版时间线 + 功能板块过滤
- **发版时间线**：同步 GitHub Release/Tag；节点挂演进 / 迭代计划；展示本版涉及板块；未挂版本单独分区
- **板块标签**：演进 `module` + 可选 `releaseTag`；灵感沿用 `relatedModule`；项目可配 `featureModules`
- **变更原因弱提醒**：可空，表单与列表空原因时弱提示（不阻断保存）
- **MCP**：`add_evolution` 支持 `module` / `releaseTag`
- **Migration**：`028_evolution_modules.sql`

## v1.8.0 · 2026-07-19

- **项目父子树形**：`studio_projects.parent_id` / `projects.parent_id`（仅一层）
- **项目库 / 工作台**：子项目缩进展示（元井水泵挂在 AI 控制器下）
- **Seed / Migration**：`027_project_parent.sql`；生产已知 id `proj-c84ff6fa` → `proj-ai-controller`

## v1.7.6 · 2026-07-18

- **作品集 Prompt 模板**：项目恢复 / 概览挂载 Case Study 面板（叙事主线 · 生成 Prompt · 空模板，可一键复制）
- **模板文档**：`docs/templates/case-study-*.md`；Concept 模板与「传统文化知识图谱」示例；「随心而行」Case Study 示例（`docs/case-studies/`）
- **Idea 补充定位**：Concept / Case Study 不阻断 Idea → Project

## v1.7.5 · 2026-07-17

- **操作者代号**：助手写入显示「白昼」，ChatGPT 显示「星辰」（不再用「系统」）；动态灰字备注对话窗口；灵感来源 / 资料 takeaway 对齐 `白昼|星辰 · …`
- **项目桥接**：水泵 / Star Lab OS / 个人效能工具箱等 Studio↔PM slug 映射

## v1.7.4 · 2026-07-16

- **项目库自定义字段**：全局列定义（文本/数字/日期/勾选/单选/链接）；表格内联编辑；新建项目「更多字段」可填；Migration `026_studio_project_custom_fields.sql`

## v1.7.3 · 2026-07-16

- **三套入口打通**：快记「保存并转成项目」；新建项目可选来源灵感（预填 + convert：关联灵感 / 定位 / 初始演进）；灵感流「转成项目」沿用同一链路

## v1.7.2 · 2026-07-16

- **新建项目**：字段对齐创建接口；默认精简，更多字段可折叠
- **项目库内联编辑**：定位 / 下一步 / 阶段 / 优先级 / 状态可点改
- **空「下一步」**：工作台与项目库弱提醒；可从最近未完成任务一键采纳草稿
- **灵感转项目**：带出定位、优先级、下一步、正文；同步子任务；初始演进记来源灵感

## v1.7.1 · 2026-07-16

- **项目库**：网页「＋新建项目」（对接已有 API / MCP `create_project`）
- **灵感流**：默认隐藏已完成灵感（与已入池一致；「含已入池」可一并显示）

## v1.7.0 · 2026-07-15

- **资源中心**：九类入口（体验/代码/部署半自动）；GitHub Release/Tag 同步与版本切换
- **迭代计划**：起止日状态切片、挂版本、本期顶层模块概况（完成/进行/待开始）
- **需求表**：结束时间 / AI补充等内置列；自定义列；Side Peek 结束时间
- **Migration**：`025_releases_and_iteration_version.sql`（`studio_releases` + iterations 日期/版本字段）

## v1.6.1 · 2026-07-15

- **capture_idea 查重 + 自动挂父**：标题相似度 ≥0.85 拒绝新建（可 `force:true`）；未传 `relatedIdeaId` 时尝试挂顶层总纲；返回 `parentAutoLinked` / `parentAlternatives`

## v1.6.0 · 2026-07-15

- **MCP P2 工作台**：`get_project` / `create_project` / `update_project` / `create_asset` / `add_evolution` / `add_decision` / `link_item` / `generate_brief` / `summarize_project` / `summarize_day`
- **关系与日志**：`023_studio_links_and_ai_logs.sql`（`studio_links` + `studio_ai_action_logs`）
- **Migration 序号修正**：DDL/记忆字段改为 `021` / `022`（避免与 `019_requirement_tree_links` 撞号）

## v1.5.0 · 2026-07-15

- **MCP P0 查库/改库**：`list_tables` / `describe_table` / `add_column` / `create_table` / `create_index`（仅 `studio_*`，需 `confirm:true`）
- **stdio 落盘**：本地 `mcp:stdio` 改库成功后自动写下一序号 migration；远程 HTTP 只改库并提示补文件
- **MCP P1 灵感记忆**：`search` / `get_idea`；Ideas 增补来源/模块/AI补充/沉淀字段；`capture_idea` / `update_idea` 入参扩展

## v1.4.0 · 2026-07-14

- **灵感流 `/stream`**：时间线 / 表格双视图；底部 Enter 快记；项目标签筛选；`/inbox` 重定向
- **整理今日脑暴**：`POST /api/studio/ideas/digest` + 确认执行路由（转项目 / 转任务 / 观察 / 丢弃）
- **创造宇宙星图**：工作台首页 Canvas 星空（灵感星 / 落地星球 / 废弃流星）
- **灵感状态 `done`**：可不拆任务直接标完成；MCP `update_idea` / `list_ideas` 支持；与 `converted`（转新项目）区分
- **侧栏退出登录**：`WorkbenchShell` 底部恢复「退出登录」
- **014 种子 SQL**：补齐 `projects` Git 列后再插入，避免未跑 005 时报缺列

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
