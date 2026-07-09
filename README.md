# Star PM — 轻量原型项目管理 V1

**当前版本：v1.1.2**（见 [CHANGELOG.md](./CHANGELOG.md)）  
**原型 → 需求 → 开发 → 测试 → 产品验收** · 并行 **Idea Studio**（`/studio`）

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
| 需求看板 | 统一状态流，8 秒自动刷新同步 |
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
