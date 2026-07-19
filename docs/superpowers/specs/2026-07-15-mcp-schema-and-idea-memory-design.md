# MCP 查库/改库 + Ideas 记忆层（P0→P1）

日期：2026-07-15  
状态：已确认，实施中

## 结论

1. **P0**：受控 DDL MCP（查表结构 + 加列/建表/索引），禁止任意 SQL、禁止 DROP  
2. **落盘**：仅本地 `mcp:stdio` 在远程执行成功后写 `supabase/migrations/NNN_xxx.sql`；远程 HTTP 只改库并提示补 migration  
3. **P1**：补齐 Ideas 记忆字段 + `search` / `get_idea`；扩展 `capture_idea` / `update_idea`  
4. **P2**（已实现）：`create_project` / `update_project` / `get_project` / `create_asset` / `link_item` / `add_evolution` / `add_decision` / `generate_brief` / `summarize_project` / `summarize_day` + `studio_links` / `studio_ai_action_logs`

## P0 工具

| 工具 | 作用 |
|---|---|
| `list_tables` | 列出白名单表（`studio_%`） |
| `describe_table` | 列名/类型/可空/默认值 |
| `add_column` | `ADD COLUMN IF NOT EXISTS` |
| `create_table` | `CREATE TABLE IF NOT EXISTS`（白名单表名） |
| `create_index` | `CREATE INDEX IF NOT EXISTS` |

安全：表名须 `studio_[a-z0-9_]+`；列名须合法标识符；类型枚举；写操作需 `confirm: true`；Postgres `star_pm_exec_ddl` 二次校验。

## P1 Ideas 字段

新增：`chat_topic`、`ai_supplement`、`source_chat`、`source_method`、`related_module`、`decision_notes`、`evolution_notes`、`related_assets_note`

| 模板概念 | 字段 |
|---|---|
| 标题 | title |
| 产生时间 | occurred_at |
| 聊天主题 | chat_topic |
| 原始想法 | raw_input |
| AI 补充 | ai_supplement（兼保留 one_line_idea / why_it_matters） |
| 关联项目 | related_project_id |
| 关联模块 | related_module |
| 父 Idea | related_idea_id |
| 来源聊天 / 方式 | source_chat / source_method |
| 沉淀 | decision_notes / evolution_notes / related_assets_note |

状态中文映射：灵感池→inbox，验证中→reviewing，开发中→reviewing（本轮不新增枚举），已完成→done，停车场→parked。

## 数据权限

- Read / Create / Update：开  
- Delete：不开（归档）  
- DDL：仅加列/建表/索引  

## 变更记录

| 版本 | 日期 | 摘要 |
|---|---|---|
| draft | 2026-07-15 | 初稿并开实施 |
| v1.6 | 2026-07-15 | P2 工作台工具；migration 改为 021/022/023 |
