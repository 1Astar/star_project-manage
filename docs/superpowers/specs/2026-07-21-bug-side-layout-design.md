# Bug 左右布局 + 严重程度 / 类型

日期：2026-07-21  
范围：项目 Bug 列表「提 Bug」与 Bug 详情

## 布局

与需求详情一致：左正文、右基本信息。

| 左 | 右 |
|---|---|
| 标题 | 状态、严重程度、Bug 类型、指派、关联需求 |
| 重现步骤 | 创建 / 更新时间 |
| 描述 / 期望 | 解决 / 重开 |

## 字段

- `severity`：1–4（1 最高），默认 3
- `bug_type`：`code` / `ui` / `performance` / `security` / `design` / `config` / `install` / `other`
- 沿用：`repro_steps`、`description`、`assignee`、`requirement_id`、`status`

## 不做

- 不做禅道底部浮动工具条全套
- 不做附件上传（可先贴链接进描述）
