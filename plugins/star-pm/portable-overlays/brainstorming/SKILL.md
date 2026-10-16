---
name: brainstorming
description: >-
  创意/方案前先对齐意图。Star 仓不写 spec；对齐后计划写进 Star PM。
  Use when 新功能、改版、方案未定、需先讨论再动手时。
---

# Brainstorming（Star）

在动手实现前先对齐意图，避免用猜测填平逻辑洞。

## 硬规则

1. **不要假设**用户已非常清楚想要什么、以及该怎么得到。
2. **从原始需求和问题出发**；动机/目标/成功标准不清 → **停下来问**（一次一问或少量关键项）。
3. 发现逻辑漏洞、矛盾、缺前置条件 → **必须提醒**，不可默填。
4. **Star 仓不要写** `docs/superpowers/specs/*` 或长篇设计文档（除非用户明确要）。
5. 对齐意图后 → **计划写 Star PM**（Idea / ChangeSession / 需求）→ 再开做（见 `star-pm-write-release`）。
6. 文档类交付走 `doc-delivery-formats`；开新项目前先扫 GitHub 复用（见 `using-star-skills`）。

## 节奏

1. 用用户原话复述问题与成功标准。
2. 标出待确认项；每项给推荐方案 + 谁确认。
3. 用户确认后再写 PM 并实现。
