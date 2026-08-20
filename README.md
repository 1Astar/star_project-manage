# Star PM — 轻量原型项目管理 V1

**当前版本：v1.1.2**（见 [CHANGELOG.md](./CHANGELOG.md)）  
**原型 → 需求 → 开发 → 测试 → 产品验收** · 并行 **Idea Studio**（`/studio`）

## StarPM Method（给 Agent 复用）

> **StarPM 记住项目为什么变成今天这样。**

四层：Method → Skill（免费 v0.1）→ MCP Interface（说明公开）→ Core（闭源）。  
可移植包：[`method/starpm-skill/`](./method/starpm-skill/)（[`README`](./method/starpm-skill/README.md) · [`SKILL`](./method/starpm-skill/SKILL.md) · [`CONNECT_MCP`](./method/starpm-skill/CONNECT_MCP.md) · [`EXAMPLES`](./method/starpm-skill/EXAMPLES.md) · [晨光手记](./method/starpm-skill/DEMO_CHENGGUANG.md) · [MAS](./method/starpm-skill/MAS_HOST.md)）

**定案：** Skill v0.1 可免费公开（独立仓 [starpm-method](https://github.com/1Astar/starpm-method)）；Core + MCP Server 不开源。  
父仓镜像：[`method/starpm-skill/`](./method/starpm-skill/)

## 快速开始

```bash
cd C:\Users\l1397\Projects\star-pm
npm install
npm run dev
```

- 应用：http://localhost:3000
- 登录：admin / （见环境变量 `ADMIN_PASSWORD`）
- UI 方向预览：http://localhost:3000/ui-preview

## 功能清单

| 模块 | 能力 |
|------|------|
| 项目总览 | AI 宠物 / AI 控制器 切换，完成度、阻塞、待测试、待验收 |
| 需求看板 | 状态机：想法→已规划→AI开发中→待验收→完成（可放弃）；拖拽改状态 |
| 需求详情 | 验收项绑定，测试/产品逐项核对 |
| 原型工作区 | iframe 沙箱 + 右侧同源任务面板 |
| 分享链接 | 角色免登录协作，token 哈希存储，可停用 |
| Excel | 合并表头解析、预览、确认写入、导出 |
| 甘特图 | 模块级 / 需求级双轨，不虚构子需求时间 |
| 工时统计 | 模块级工时不重复累计 |
| 通知 / 待办 | 系统内通知中心 + 我的待办 |
| 分享详情页 | `/share/[token]/items/[id]` |
| Cron | 每日 9:00 截止提醒（Vercel Cron） |
| **Idea Studio** | `/studio` 灵感收件箱、项目库、演进记录、Notion 导入（v1.1） |
| **Git 同步** | 项目详情手动同步 GitHub 最近 commit |

## 环境变量

```env
# 管理员（本地默认即可）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password
ADMIN_SESSION_SECRET=change-me
REQUIRE_AUTH=false          # 本地开发可关闭登录

# 观看者（对外演示）：只见「晨光手记」沙盘，只读
VIEWER_USERNAME=viewer
VIEWER_PASSWORD=12345

# Cron（Vercel 部署时设置）
CRON_SECRET=your-cron-secret

# Supabase（生产必填，本地填上后数据持久化到云库）
# Dashboard → API：https://supabase.com/dashboard/project/gwqfrpstgjkwhhxbshkz/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://gwqfrpstgjkwhhxbshkz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=          # anon public
SUPABASE_SERVICE_ROLE_KEY=              # service_role secret（仅服务端，勿泄露）
```

**判定规则**：`URL + SUPABASE_SERVICE_ROLE_KEY` 同时有值 → 走 Supabase；否则本地 `data/db.json` / Vercel 内存。

## 部署（Vercel）

1. 推送仓库到 GitHub
2. Vercel 导入项目，Root Directory: `star-pm`
3. 配置环境变量：`ADMIN_*`、`CRON_SECRET`、上述 3 个 Supabase 变量
4. `vercel.json` 已配置每日 Cron：`/api/cron/reminders`
5. 部署后访问 `/api/health/db` 确认 `storage: "supabase"` 且 `ok: true`

## 部署（腾讯云 EdgeOne Makers）

当前适合「国内能打开 + 免费档」：控制台开通 [EdgeOne Makers](https://pages.edgeone.ai/) 免费版，连接本仓库部署 Next.js。

1. 打开 [EdgeOne Makers 控制台](https://console.cloud.tencent.com/edgeone/pages) → 开通 Makers → **导入 Git 仓库**（`1Astar/star_project-manage`）
2. 框架选 Next.js；根目录为仓库根（有 `package.json` / `edgeone.json`）
3. 在项目 **环境变量** 中配置（可从本地 `.env` 批量粘贴；**单值最长 500 字节**）：

| 必填 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | 生产数据 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` | 登录 |
| `CRON_SECRET` | 定时与手动验收 |
| `NEXT_PUBLIC_EDGEONE=1`（或 `EDGEONE=1`） | 标记生产运行时，走 Supabase 强校验 |
| `STAR_PM_MCP_SECRET` | MCP Bearer（若用 MCP） |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | MCP OAuth（若用） |
| `GITHUB_TOKEN` 等 | Git 同步（若用） |

4. 部署成功后打开站点，访问 `/api/health/db` → `ok: true` 且 `storage: "supabase"`
5. **Cron**：根目录 `edgeone.json` 已配置 UTC `09/10/11:00` 三条 `GET /api/cron/*`（与 Vercel 对齐）。若平台调度未带 `Authorization` 导致 401，任选其一：
   - 用外部定时（推荐）对上述 URL 发 `Authorization: Bearer $CRON_SECRET`
   - 或临时设 `CRON_ALLOW_EDGEONE_SCHEDULE=1`（确认仅调度会打这些路径后再开）
6. 函数超时：`edgeone.json` 里 `cloudFunctions.nodejs.maxDuration: 60`（MCP/同步用）

### EdgeOne 验收清单

| 项 | 验收 |
|----|------|
| 健康检查 | `GET /api/health/db` → supabase |
| 国内打开 | 手机流量打开站点首页/登录 |
| Studio / 看板 | 基本读写 |
| MCP | Bearer + `list_projects`（可选） |
| Cron | 手动 `curl -H "Authorization: Bearer $CRON_SECRET" https://<域名>/api/cron/reminders` |

官方参考：[Next.js 指南](https://pages.edgeone.ai/zh/document/framework-nextjs) · [edgeone.json](https://pages.edgeone.ai/zh/document/edgeone-json) · [从 Vercel 迁移](https://pages.edgeone.ai/zh/document/migrating-from-vercel-to-edgeone-pages)

## 部署（Cloudflare Workers）

基于 [@opennextjs/cloudflare](https://opennext.js.org/cloudflare/get-started) + Wrangler，与 Vercel 部署并存。

1. 安装依赖：`npm install`
2. **Build 环境变量**：OpenNext/Next 在 `build` 阶段内联 `NEXT_PUBLIC_*`，需通过 `.env.local` / `.env*`（或 CI 环境变量）提供；`.dev.vars` 仅用于 Wrangler **运行时** secrets / `preview`，不参与 Next build。本地 preview 请保持两者值一致。
3. 复制 `.dev.vars.example` → `.dev.vars`，填入运行时密钥（本地 preview 用）
4. **生产必填**：`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`（及 `NEXT_PUBLIC_SUPABASE_ANON_KEY`）、`ADMIN_*`、`CRON_SECRET`、MCP/OAuth 相关变量；Upstash REST（`KV_REST_API_*`）用于 OAuth token 存储
5. 本地 Workers 预览：`npm run preview`（Windows 上 OpenNext build 已通过；仍建议 preview/deploy 冒烟验收）
6. 部署：`npm run deploy`（需已登录 `wrangler login`；脚本带 `--keep-vars`，避免覆盖 Cloudflare 控制台已配置的 plaintext 环境变量）
7. 部署后访问 `/api/health/db` 确认 `storage: "supabase"`

**Cron（Cloudflare Cron Triggers）**：`wrangler.jsonc` 配置 UTC `0 9/10/11 * * *`，`cloudflare-worker.ts` 的 `scheduled` 处理器经 `WORKER_SELF_REFERENCE` 自调用现有 `/api/cron/*` 路由，携带 `Authorization: Bearer ${CRON_SECRET}`。手动验收：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-worker>/api/cron/reminders
```

**MCP on Workers**：默认不配置 TCP Redis（`REDIS_URL` / `UPSTASH_REDIS_URL`）；SSE 关闭，仅 Streamable HTTP + Bearer/OAuth。OAuth token 仍用 Upstash REST（`KV_REST_API_*`）。`mcp:stdio` 仅本地。

### Cloudflare 验收清单

| 项 | 验收方式 |
|----|----------|
| 健康检查 | `GET /api/health/db` → `ok: true`, `storage: "supabase"` |
| 登录 | admin 登录成功 |
| Studio | `/studio` CRUD（灵感/演进） |
| 看板 | 项目需求看板拖拽改状态 |
| MCP Bearer | `POST /api/mcp` + `Authorization: Bearer $STAR_PM_MCP_SECRET`，`list_projects` / `get_ai_rules` |
| 原型 ZIP | 项目原型页上传 ZIP → Supabase Storage URL |
| Excel | 项目 Excel 导入预览 + 导出 |
| Cron | 手动 `curl` 上述 cron 路由 → `200` + `{ ok: true }` |

**Excel / OpenNext build**：`exceljs` 在 Workers 上依赖 `nodejs_compat`；若 OpenNext bundle 报错，在 Linux/WSL/CI 上复现后再做最小修复。Windows 本地 OpenNext build 已通过（Task 3）；仍建议 preview/deploy 冒烟验收。

## 数据库

### Supabase 首次初始化

在 [SQL Editor](https://supabase.com/dashboard/project/gwqfrpstgjkwhhxbshkz/sql/new) 依次执行：

1. `supabase/migrations/001_init.sql` — 建表
2. `supabase/migrations/002_rls.sql` — RLS（可选）
3. `supabase/migrations/005_git.sql` — Git 活动表（可选）
4. `supabase/migrations/007_studio.sql` — Idea Studio 表（使用 `/studio` 时执行）

本地验证连接：

```bash
npm run db:check
```

### 存储模式

| 环境 | 条件 | 存储 |
|------|------|------|
| 本地 | 未配 Service Role | `data/db.json` |
| 本地 / Vercel | 已配 Service Role | Supabase PostgreSQL |
| Vercel | 未配 Service Role | 内存（重启丢失） |

## Excel 导入测试

在「项目 → Excel 导入」上传：

- `宠物app优化需求工时表.xlsx`
- `AI控制器优化需求工时表.xlsx`

预览确认后点击「确认导入」。
