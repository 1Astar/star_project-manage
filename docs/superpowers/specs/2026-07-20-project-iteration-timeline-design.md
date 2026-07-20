# 项目迭代时间线 · 发版 + 板块追溯 — 设计说明

**日期：** 2026-07-20  
**状态：** P0 已落地（2026-07-20）；P1 Tag 变更说明 + publish_release 见 v1.9.1  
**范围：** 升级各项目「迭代记录」页；板块标签；变更原因弱提醒

---

## 结论

1. **方案 A**：升级现有 `/projects/[id]/evolution`，不新建独立发版页。  
2. **小 tab**：默认「项目发版」时间线 + 各「板块」过滤时间线。  
3. **发版节点** = GitHub Release/Tag（`studio_releases`，可同步）。  
4. **板块** = 项目级功能模块列表（可自定义；Star PM 默认：工作台/项目库/灵感/需求任务/迭代记录/资源中心/Git/设置）。  
5. **打标**：演进 `module` + 可选 `releaseTag`；灵感沿用 `relatedModule`；发版卡聚合本版涉及板块。  
6. **变更原因**：可选；为空时 UI **弱提醒**（不阻断保存）。

---

## 交互

### 项目发版（默认 tab）

- 纵向时间线，新 → 旧。  
- 每节点：版本号、发布时间、Release body、关联演进 / 迭代计划（`release_tag` 对齐）。  
- 无 Tag 的演进落在「未挂版本」区。  
- 「同步版本」调用已有 `/api/studio/projects/[id]/releases/sync`。

### 板块 tab

- 点某个板块：只看该 `module` / `relatedModule` 的演进与灵感。  
- 可手动补一条演进（标题、时间默认 now、板块、可选关联版本、原因弱提醒）。

---

## 数据

| 实体 | 字段 |
|------|------|
| `studio_evolution_logs` | `module`、`release_tag`（migration `028`） |
| `studio_projects` | `feature_modules` jsonb |
| `studio_ideas` | 已有 `related_module` |
| `iterations` | 已有 `release_tag` |
| `studio_releases` | 已有 |

---

## 非目标（P0 不做）

- CHANGELOG 自动导入为带板块条目  
- 需求池 Excel 模块与功能板块强制合一  
- 强制填写变更原因  
