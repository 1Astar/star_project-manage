---
name: using-star-skills
description: >-
  开场必用：行动前检查并加载适用的 Star PM / 文档交付 skills。
  Use when starting any conversation in the star workspace, writing reports/PPT/方案,
  editing docx, deleting files, versioning docs, writing Star PM, or when unsure
  which skill applies — before exploring or editing.
---

# Using Star Skills（行动前必查）

## 硬规则

在**任何回复、探索、改文件之前**：

1. 扫可用 skills；只要有 **≥1%** 可能适用，就先 `Read` 对应 `SKILL.md`，再动手。
2. 涉及 Star 文档/调研/Word/PPT/方案/删文件/版本/写 PM → **先读索引**，再按表加载：
   - 索引：`E:\文档\star\工具\private\工具\star_project-manage\.cursor\skills\README.md`
   - 文档总入口：`doc-delivery-formats`
   - 写 PM / 收工推进下一步：`star-pm-write-release`
3. 宣布：`Using [skill] to [purpose]`，并按 skill 正文执行。
4. 被派为 **subagent 且任务已收窄** 时可跳过本开场 skill，但仍遵守 `safe-file-delete`、`version-management` 等硬约束。
5. **开新项目 / 新能力前先扫 GitHub（硬规则）**：做一个项目之前可以先看一下 GitHub 上有没有能直接复用的项目 或者能部分拿来用的。未检索就从零搭骨架 → 先补检索再动手（见下节）。

## 开项目前：GitHub 复用检索（硬规则）

触发：新建仓库/新产品、从零搭模块、引入陌生技术栈、或用户说「做一个…项目/工具/站」。

1. **先搜再写**：用 `gh search repos` / WebSearch / 已知优质源，找能**整仓复用**或**部分抽取**的项目（模板、SDK 示例、相近产品开源实现）。
2. **向用户交代检索结论**（简短即可）：可直接用 / 可抄局部 / 仅作参考 / 未找到合适的；附 1～3 个候选链接与取舍理由。
3. **再开做**：对齐是否 fork、vendoring、只借鉴架构，或确认从零写；结论可记入 Star PM（Idea / Decision）。
4. **例外**：用户明确说「不要找开源、就按现有仓改、续作小修」时可跳过；纯文档/排版/PM 写入不强制。

## 常见路由（一眼）

| 你要做的事 | 先加载 |
|------------|--------|
| 写/改调研报告、Word | `doc-delivery-formats` → `word-docx-professional` + `version-management` |
| 咨询风 PPT | `ppt-consulting-visual` |
| 产品方案书 | `product-scheme-design` |
| 删文件 | `safe-file-delete` |
| 记灵感 / 勾完成 / 改下一步 P / 发版 | `star-pm-write-release` |
| **做完后续接什么 / 插队归队 / 防双盲** | `star-pm-write-release` §1.5（下一步必写必说） |
| **本期不做 / 后期再做 / 定稿「不做」清单** | `defer-scope-record`（写清详情）→ 再 `star-pm-write-release` 落 PM |
| 宣称做完了 | `verification-before-completion` |
| 创意功能但未对齐 | `brainstorming` |
| **开新项目 / 从零搭能力** | **本 skill「GitHub 复用检索」** → 再 `brainstorming` / 写 PM / 开做 |

## 跨窗口

本 skill 与 PM 库 skill 通过 `~/.cursor/skills/` 挂载后，**任意 Cursor 窗口**都应能在 Agent Skills 列表中看到。  
若新窗口仍看不到：重开该窗口，或确认 `C:\Users\l1397\.cursor\skills\<name>` 指向 PM 库目录。

## 与 using-superpowers

通用「先查 skill」原则与 `using-superpowers` 一致；在 Star 仓库优先走本 skill + README 索引。
