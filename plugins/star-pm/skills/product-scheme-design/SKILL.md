---
name: product-scheme-design
description: >-
  产品/项目方案设计书结构：背景、目标、方案、体验、风险、路线图。
  Use when 写产品方案、项目建议书、立项文档、技术+产品混合方案时。
---

# 产品 / 项目方案设计书

与 `doc-delivery-formats`、`word-docx-professional`、`version-management` 联用。  
对齐意图可先 `brainstorming`；字段落盘 `star-pm-write-release`。

## 动笔前

1. 动机 / 目标 / 成功标准不清 → **先和用户讨论**（`CANONICAL_RULES` §5）  
2. 全链路逻辑验证：问题 → 假设 → 方案 → 数据流 → 验收 → 发版影响  
3. 开新项目前扫 GitHub 复用（`using-star-skills`）

## 推荐目录（可按项目裁剪）

```text
1. 文档说明（版本、作者、日期、修订记录）
2. 背景与问题定义
   - 行业/用户/现状痛点
   - 为什么要做（机会窗口）
3. 目标与成功标准
   - 业务目标、用户目标、可度量指标
4. 范围与边界
   - 本期做 / 不做（不做走 defer-scope-record）
5. 用户与场景
   - 角色、关键旅程、频次
6. 方案总览
   - 一句话方案 + 架构图/结构图（文字描述亦可）
7. 功能 / 能力拆解
   - 模块表：能力 · 优先级 · 依赖
8. 关键体验（Key Experience）
   - 3–5 条端到端体验描述
9. 数据与集成（若适用）
10. 非功能需求（性能、安全、合规）
11. 风险与对策
12. 里程碑与路线图
13. 资源与估算（可选）
14. 附录（竞品、政策、术语）
```

## 写作要求

- **Problem → Goal → Solution** 链条必须闭合  
- 每个大章先给**一句结论**再展开  
- 「不做」单独成节或表，与 `defer-scope-record` 一致写清  
- 方案须**可验收**：每条能力能对应验收标准或演示路径  
- 避免空泛「提升效率」；改成可观察行为或指标

## 交付

- 默认落 **Word**（`word-docx-professional`）  
- 需汇报时加 **PPT 摘要版**（`ppt-consulting-visual`，10–15 页）  
- 结构化扫读可加 **Canvas**（无图依赖）

## 版本

- 方案**方向变** → 大版本新文件  
- 同方向增补章节 → 小版本新文件或同文件小改（见 `version-management`）  
- 发版 / 对外说明 → `star-pm-write-release` §2

## PM 联动

- 立项结论 → Idea / Requirement  
- 裁切与延期 → `defer-scope-record` 子项  
- 做完 → 勾完成 + 写清下一步
