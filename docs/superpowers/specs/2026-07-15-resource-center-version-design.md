# 项目资源中心 · 版本 · 迭代 — 设计说明

**日期：** 2026-07-15  
**状态：** P0–P2 已落地（2026-07-15）
**范围：** 半自动资源中心 + GitHub Release/Tag 版本 + 时间切片迭代

---

## 结论

1. **资源中心**改为九类入口：在线体验 / 代码仓库 / 设计稿 / 文档 / 素材 / Prompt / API / 部署 / 视频。  
2. **半自动：** 体验、代码、部署从项目字段带出；其余六类人手挂链接/上传。  
3. **版本** = GitHub Release / Tag（同步入库）。  
4. **迭代** = 带起止日的计划，时间切「未开始 / 进行中 / 已过期」，可选绑定一个版本。  
5. **模块概况（本期）：** 按需求树顶层「大型模块」汇总该迭代内完成/进行/待开始数量（模块对照 diff 留二期）。

---

## 资源中心

| 分区 | 键 | 来源 |
|---|---|---|
| 在线体验 | `experience` | `project.demoUrl`（可再手加同类型链接） |
| 代码仓库 | `repo` | `project.githubRepo` → GitHub URL（可绑当前 Tag 树） |
| 部署 | `deploy` | `project.vercelUrl` + `localRunGuide` |
| 设计稿 | `design` | 人工 Asset |
| 文档 | `doc` | 人工 Asset |
| 素材 | `material` | 人工 Asset（兼容旧 `ui_ref`/`competitor`/`inspiration` 归并展示） |
| Prompt | `prompt` | 人工 Asset |
| API | `api` | 人工 Asset |
| 视频 | `video` | 人工 Asset |

- 顶栏可选「当前版本 / 全部 / 未归档」过滤（版本字段一期先占位，P1 接 Sync）。  
- 旧 AssetType：`ui_ref→design`，`tech_doc→doc`，`competitor|inspiration→material`；读时归一，写用新枚举。

---

## 版本（Release / Tag）

- 源：`GET /repos/{owner}/{repo}/releases`（含 draft=false；也可含最新 tags 补无 release 的 tag）。  
- 字段：`tag`、`name`、`publishedAt`、`body`、`htmlUrl`、`projectId`。  
- 项目页可「同步版本」；资料中心与迭代下拉共用该列表。

---

## 迭代

- 沿用 `iterations`：`start_date` / `end_date` 判态。  
- 新增可选 `release_tag`（或 `version_id`）挂 GitHub 版本。  
- 迭代详情：本期需求数、完成率、**按顶层模块的状态分布表**。

---

## 不做（本轮）

- 禅道式「模块维护」独立页  
- 版本间模块全量 diff  
- 灵感/附图自动灌入九类  

---

## 分期落地

| 期 | 交付 |
|---|---|
| **P0** | 资源中心九类 UI + AssetType 扩展 + 半自动条目 |
| **P1** | Release/Tag 同步表 + 版本选择器 |
| **P2** | 迭代挂版本 + 本期模块概况 |
