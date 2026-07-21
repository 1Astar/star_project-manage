# Notion 表格第一轮 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 项目库支持列宽/左侧+/拖拽排序与挂子/表格↔看板；需求总览支持看板↔表格切换。

**Architecture:** 增强现有 `ProjectLibraryTable` + 新建看板组件；`GlobalRequirementBoard` 增加 URL 视图切换与轻量表格。列宽与同级顺序用 localStorage；`parentId`/`status` 走现有 PATCH API。

**Tech Stack:** Next.js 15、React 19、HTML5 DnD、localStorage、现有 studio projects API

## Global Constraints

- 父子仅一层（`assertValidParent`）
- 本轮不做需求总览 Notion 筛选增强
- 不新增 npm DnD 库

---

## File map

| File | Role |
|------|------|
| `lib/studio/project-library-prefs.ts` | 列宽 + 顺序 localStorage |
| `components/project-library-table.tsx` | 表格交互增强 |
| `components/project-library-board.tsx` | 按状态看板 |
| `components/project-library-views.tsx` | 表格/看板切换壳 |
| `app/projects/page.tsx` | 读 `view` searchParam |
| `components/global-requirement-board.tsx` | 看板/表格切换 |
| `components/global-requirement-table.tsx` | 轻量需求表格 |
| `docs/superpowers/specs/2026-07-21-notion-table-round1-design.md` | 已批准设计 |

---

### Task 1: prefs helpers

- [ ] 新增 `lib/studio/project-library-prefs.ts`：`colWidths`, `order` 读写；`applyProjectOrder(projects, order)`
- [ ] Commit

### Task 2: 项目库表格 — 列宽 + 左侧 + + 拖拽

- [ ] 改造 `ProjectLibraryTable`：列宽拖拽、行左 `+`/`⋮⋮`、DnD 排序与挂父
- [ ] `+` 创建子项目：`POST`/`create` 带 `parentId`（查现有 create API）
- [ ] Commit

### Task 3: 项目库看板 + 视图切换

- [ ] `ProjectLibraryBoard` 按状态列 + 拖改 status
- [ ] `ProjectLibraryViews` + `app/projects/page.tsx` `?view=board`
- [ ] Commit

### Task 4: 需求总览表格视图

- [ ] `GlobalRequirementTable` + `GlobalRequirementBoard` `?view=table|board`
- [ ] Commit

### Task 5: CHANGELOG v1.10.12 + ship

- [ ] 版本与发版
