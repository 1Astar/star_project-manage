# Star PM — 轻量原型项目管理 V1

**原型 → 需求 → 开发 → 测试 → 产品验收**

## 快速开始

```bash
cd C:\Users\l1397\Projects\star-pm
npm install
npm run dev
```

- 应用：http://localhost:3000
- 登录：admin@star.local / star-pm-dev（可通过环境变量修改）
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

## 环境变量

```env
# 管理员（本地默认即可）
ADMIN_EMAIL=admin@star.local
ADMIN_PASSWORD=star-pm-dev
ADMIN_SESSION_SECRET=change-me
REQUIRE_AUTH=false          # 本地开发可关闭登录

# Cron（Vercel 部署时设置）
CRON_SECRET=your-cron-secret

# Supabase（可选，接入云数据库时）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## 部署（Vercel）

1. 推送仓库到 GitHub
2. Vercel 导入项目，Root Directory: `star-pm`
3. 配置环境变量（`ADMIN_*`, `CRON_SECRET`, Supabase 可选）
4. `vercel.json` 已配置每日 Cron：`/api/cron/reminders`

## 数据库

- **本地开发**：`data/db.json` 自动种子数据
- **生产**：执行 `supabase/migrations/001_init.sql` 与 `002_rls.sql`

## Excel 导入测试

在「项目 → Excel 导入」上传：

- `宠物app优化需求工时表.xlsx`
- `AI控制器优化需求工时表.xlsx`

预览确认后点击「确认导入」。
