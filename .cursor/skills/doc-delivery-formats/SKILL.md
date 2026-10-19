---
name: doc-delivery-formats
description: >-
  Star 文档交付总入口：写作原则、格式路由、Canvas 限制、成品目录规范。
  Use when 写调研/报告/方案/Word/PPT/Canvas、决定交付格式、或不确定该用哪种文档 skill 时。
  内容架构 / 高保真 Web 原型详见 content-architecture。
---

# 文档交付格式（总入口）

Star 文档类任务的**路由 skill**。先读本文件，再按表加载子 skill。

权威规则：`docs/ai/CANONICAL_RULES.md` · MCP `get_ai_rules`  
版本与改稿：`version-management` · 删档：`safe-file-delete`  
**内容架构 / 信息设计 / Web 高保真原型**：`content-architecture`（七阶段 + `web-prototype.md`）

## 硬规则

1. **交付目录只放成品**（`.docx` / `.pptx` / `.pdf` / `.html` / `.canvas.tsx` 等），**不放过程 md**、草稿、Agent 笔记。过程性内容写 Star PM（Idea / Evolution / ChangeSession）。
2. **改任何交付物前**：检查用户是否已改过；用户改过 → 在其**当前保存版**上增量改（`version-management`）。
3. **文档小修改不新建文件**；小版本 / 大版本迭代才新增带版本号文件名。
4. **宣称完成前**：跑 `verification-before-completion`（生成成功、路径正确、用户可打开）。
5. **Canvas 限制**：结构化扫读、章节块、表格/列表为主；**不要依赖 Canvas 内嵌图片组件**做核心信息承载（无图时仍可读）。复杂视觉用 Word/PPT/HTML PPT。
6. **Star 仓默认不写** `docs/superpowers/specs`；方案对齐写 PM，不另起长篇 spec（除非用户明确要）。
7. **动手排版前**先过下方「信息组织」五项；完整七阶段与 Web 原型流程 → 加载 `content-architecture`。

## 格式路由

| 交付物 | 加载 skill | 备注 |
|--------|------------|------|
| 内容架构 / 叙事主线 / 设计系统 / 高保真 Web 原型 | `content-architecture`（先）→ 再按载体加载 Word/PPT/HTML | 禁止直接开排版；演示数据须标明 |
| 调研报告 / 商务 Word | `word-docx-professional` + `version-management` | Node `docx` 程序化生成优先 |
| 咨询风商业 PPT | `ppt-consulting-visual` | 科技蓝 + 纸感；杂志风/SVG 用 guizang / ppt-master |
| 产品 / 项目方案设计书 | `product-scheme-design` + `word-docx-professional` | 结构先对齐再落 Word |
| PRD / 原型交互 | `prd-prototype-rules`（先）→ 再改 PRD/原型 | **先定规则清单，再写交付物**；规则要点**分层列表** |
| 横向翻页网页 PPT / 发布会风 | `guizang-ppt-skill` 或 `ppt-master` | 非咨询风 PPT 时 |
| 删旧版 / 清理文件 | `safe-file-delete` | 必须用户确认 |
| 写 PM / 发版记录 | `star-pm-write-release` | 非文档成品 |

## 写作原则

- **可扫读**：标题动词或结果在前；一段一意；列表优于长段。
- **有证据**：数据、政策、竞品结论标来源或「待核实」；不编造。
- **分层**：执行摘要 → 背景/问题 → 分析 → 结论/建议 → 附录（可选）。
- **语气**：专业、克制；商业文档避免口语和空洞形容词。
- **中英混排**：中文正文用雅黑类字体；英数用 Times New Roman 或同档衬线（细则见 `word-docx-professional`）。

## 信息组织（硬规则 · 开场五项）

从「把需求做出来」升级到「别人一眼能理解、相信并采取行动」。  
**首页 / PPT / 方案 / Word / 演示网页**动手前先写这五项（可进 Star PM Idea，不另起长 md）：

```text
目标用户：
使用场景：
核心结论：
信息层级：
用户下一步：
```

写完再决定用网页、PPT、Word、图表还是流程图。  
**完整流程**（理解内容 → 主线 → 视觉 → 设计系统 → 适配载体 → 编写 → 检查）与 **高保真 Web 原型八步** 见 skill `content-architecture`。

### 1. 目标判断

```text
给谁看？
他最关心什么？
看完要做什么决定？
```

同一份内容给领导、客户、操作员看，**结构完全不同**；禁止一套稿通吃。

### 2. 内容分层

```text
结论 → 证据 → 过程 → 详细资料
```

**首屏 / 第一页放结论**，细节往后放。

### 3. 内容与形式匹配

| 内容类型 | 更适合的表达 |
|----------|--------------|
| 数据 | 指标卡、图表 |
| 流程 | 流程图、泳道图 |
| 层级关系 | 架构图、树状结构 |
| 对比 | 对比表、矩阵 |
| 案例 | 场景卡、前后变化 |
| 任务状态 | 时间线、状态列表 |
| 长篇说明 | 章节、摘要、侧边导航 |

禁止只会「把内容塞进模板」；必须先问「这种内容最适合什么形式」。更全对照表见 `content-architecture`。

### 4. 页面主线

每个页面、每页 PPT、每个 Word 章节，都要有一句中心话：

> 看完这一页，用户应该记住什么？

没有中心话 → 内容越多越散，先补中心话再排版。**一页一事。**

### 5. 视觉主次

- 哪个内容最大 / 最先看到  
- 哪些可以弱化 / 哪里留白  
- 哪里是唯一视觉焦点  

统一字体色间距编号；布局随内容类型变化。忌整稿同一套卡片堆砌。

### 6. 从信息到行动

```text
看到异常 → 查看原因
看到建议 → 确认执行
看到 AI 员工 → 查看任务
看到数据 → 进入分析
看到方案 → 选择或购买
```

展示稿要变成可行动的产品体验 / 决策材料。

## Canvas 使用场景

适合：调研结构化扫读、方案目录预览、多板块对照表。  
不适合：依赖大图的海报、精细 UI 稿、需要打印的正式交付（改 Word/PPT）。

路径习惯：`canvases/<topic>.canvas.tsx`（项目内）或用户指定 Canvas 项目路径。

## 收工检查

- [ ] 成品在约定目录，无多余过程 md  
- [ ] 文件名含版本号规则正确（小改同文件 / 大改新文件）  
- [ ] 用户未改过的旧稿未覆盖用户已改文件  
- [ ] 需要时 PM 已记 Evolution / 资产路径
