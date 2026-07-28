---
name: star-pm-write-release
description: >-
  Star PM AI 写入标准与发版规范：灵感/需求记忆字段写全（标题类型项目产生时间聊天主题
  原始想法 AI补充 为什么 状态 优先级 下一步）、新需求写产生时间、续作写 timeline、
  完成写完成时间；ChangeSession/演进/板块；CHANGELOG+git tag+publish_release。
  Use when writing to Star PM, 记需求, 捕捉灵感, 更新灵感字段, 发版, release,
  or finishing work that must be logged to the planet.
---

# Star PM · AI 写入标准与发版规范

对 **Star PM**（`star_project-manage` / MCP `user-star-pm`）写入与发版时遵循本 skill。  
大批量写入前：MCP `get_ai_rules`。仓库正文：`docs/ai/CANONICAL_RULES.md`。

## 字段原则（硬规则）

**有则写之，无则跳过。**

- 对话/证据里**已有**的信息（标题、项目、产生时间、原文、主题…）→ **必须写入对应字段**  
- **没有**的信息 → **跳过该字段**，不要编造、不要用占位废话填满  
- 工时同理：有聊天时间戳才写开始/结束；没有就留空  

例外：`title` 新建时仍必填；板块仍**强烈建议**有则写（可推断则推断，推断不出标待补齐，不瞎填）。

---

## 0. 分工（别混）

| 写什么 | 实体 | 何时 |
|--------|------|------|
| 这次改了什么（目标/执行/验收） | **ChangeSession** | 开改前 start，收工 finish |
| 产品决策 / 功能落地叙事 | **Evolution** | 有可追溯结论 |
| 灵感 / 脑暴 | **Idea** | 捕捉；可拆需求池 |
| 对外版本说明 | **CHANGELOG + git tag + GitHub Release** | 用户明确要发版 |

演进 ≠ 变更会话：演进=为什么/结论；会话=目标→勾选→验收。

---

## 1. AI 写入标准

### 1.1 动手前

1. **需求是否清楚？** 对照用户**初始要求**；若觉得不够明确 → **先细问再做**（一次一问或少量关键项），问清后再动手。  
2. **不写** `docs/superpowers/specs` / 长篇设计文档 / 单独 implementation plan 文件（除非用户明确要）。  
3. **计划与项目需求直接写进 PM**（灵感 / 任务 / 演进 / 需求池，带板块；**有则写之，无则跳过**）。  
4. 改代码或大范围写文件前：MCP **`compare_sources`**（Git / Vercel / Studio）。  
5. Vercel 领先 Git → 先同步回 Git，禁止用旧本地覆盖。  
6. 用户确认要做 → **写进 PM → 直接开做**。

### 1.2 通用字段标准

| 字段 | 标准 |
|------|------|
| **板块** `module` / `relatedModule` | **强烈建议必填**。路径用 `·`：`体系·功能面·能力`（如 `六爻·学习·五步课`）。Star PM 默认扁平：工作台/项目库/灵感/需求任务/迭代记录/资源中心/Git/设置 |
| **原因** `reason` / `why` | 可空；空则弱提醒「以后可能想不起为什么」 |
| **标题** | 短、可扫读；动词或结果在前（「板块进程表」「粘贴脑暴入库」） |
| **版本** `releaseTag` | 可选；正式发版前用 `publish_release` 挂上 |
| **工时** | 聊天时间戳 → 开始/结束 ISO；无则留空，**禁止瞎填** |

缺板块：MCP 可返回 `warning`，**不阻断**；导入场景标 **`【待补齐·板块】`** 仍入库。  
**禁止**静默丢字段；能进库的进库，缺的标出来。

### 1.3 ChangeSession 写入标准

**start_change_session**

| 字段 | 要求 |
|------|------|
| `projectId` | 必填（见 §4） |
| `goal` | 必填：本轮修改目标（一句话） |
| `reason` | 建议：为什么现在改 |
| `expected` | 建议：期望效果列表 |
| `module` | 强烈建议 |
| `startedAt` | **本轮对话最早用户消息**时间戳 ISO |

**finish_change_session**

| 字段 | 要求 |
|------|------|
| `doneItems` / `pendingItems` | ✅ / ❌ 拆开写，别糊成一段 |
| `aiOps` | 改了哪些文件/做了啥（可扫） |
| `result` | 一句话结果 |
| `finishedAt` | **本轮对话最后相关消息**时间戳 ISO |

工时：不叫「AI 工时」产品名；就是开始–结束。条目有时段，板块表可 Σ。

### 1.4 Evolution 写入标准

**add_evolution** / **add_decision**

| 字段 | 要求 |
|------|------|
| `title` | 必填，事件名 |
| `logType` | 必填（feature_add / ui_change / tech_decision / positioning…） |
| `module` | 强烈建议（发版按板块汇总；空→未分板块） |
| `before` / `after` | 建议：变化前→后 |
| `reason` / `decision` | 建议：原因与结论 |
| `workStartedAt` / `workFinishedAt` | 可选，同会话聊天时间戳 |
| `releaseTag` | 仅当已确定挂某版 |

决策类优先 `add_decision`（仍落演进，logType 偏 tech_decision）。

### 1.5 灵感 / 需求记忆字段（写全）

用户口中的「需求」若指**灵感卡片 / 记忆库**（MCP Idea），按下表写全。  
（需求池表格行字段不同：`submitted_at`≈产生日，`completed_at`≈完成日，`status_tags`≈状态；从灵感同步时应对齐。）

| 用户字段 | MCP / 存储 | 标准 |
|----------|------------|------|
| **标题** | `title` | 有则写；新建必有 |
| **类型** | `type` | 有则写，无则跳过 |
| **关联项目** | `relatedProjectId` | 有则写，无则跳过 |
| **产生时间** | `occurredAt` | **新需求有则必写**；无可靠时间则跳过（勿瞎填「现在」冒充） |
| **来源聊天主题** | `chatTopic` | 有则写，无则跳过 |
| **原始想法（我的想法）** | `rawThought` → `rawInput` | 有用户原文则写，无则跳过 |
| **AI补充分析** | `aiSupplement` | 有补充则写，无则跳过 |
| **为什么值得做** | `why` → `whyItMatters` | 有则写，无则跳过 |
| **当前状态** | `status` | 有明确状态则写 |
| **优先级** | `priority` | 有则写，无则跳过（勿默认瞎标 P1） |
| **下一步建议** | `suggestedNextStep` | 有则写，无则跳过 |

板块 `relatedModule`：有则写 / 可推断则推断；推断不出可标待补齐。其余同 **有则写之，无则跳过**。

#### 时间与时间线（硬规则）

| 情形 | 写什么 |
|------|--------|
| **新需求 / 新灵感** | 必须写 **产生时间** `occurredAt`（缺省才会变成「入库此刻」，易错） |
| **不是新需求**（续作 / 已有条目） | **不要只改标题糊弄**；补 **timeline**：`add_evolution`（带 module）和/或 `update_idea.evolutionNotes`；站内 Memory Timeline 靠关联可见 |
| **已完成** | 状态 → `done`，必须写 **完成时间** `completedAt`（以 git / CHANGELOG / 可验收证据为准，与产生日分开） |

完成判断：对照页面 + 聊天 + md + **git 提交日**；提出日 ≠ 完成日。

**capture_idea** 新建；**update_idea** 续写（含 `occurredAt` / `completedAt` / 状态）。

### 1.6 需求状态（看板）

规范：`想法 → 已规划 → AI开发中 → 待验收 → 完成`（旁路 `放弃`）。  
旧标签自动归一。入迭代：想法→已规划。测试通过→待验收。

### 1.7 写入节奏清单

```
Write:
- [ ] compare_sources（改代码前）
- [ ] start_change_session（实质改动）
- [ ] 实现 + 验证
- [ ] finish_change_session（done/pending/aiOps + finishedAt）
- [ ] add_evolution（module + 可选工时）
- [ ] 灵感/需求状态若需同步则 update
```

---

## 2. Git 发版规范

仅在用户明确说 **发版 / release / 打 tag / 发布**，或说 **差不多了 / 做完了可以发** 时执行。  
**默认节奏：功能做完并验证过 → 即可发版**（不必攒多刀再发；小改动升「修改次数」即可）。  
未要求 **commit** 不要 commit；未要求 **push** 不要 push。

### 2.1 版本号

格式：`v大.小.修改`（与 `package.json` / `CHANGELOG.md` 一致）

| 段 | 何时升 |
|----|--------|
| **大** | 产品定位 / 核心结构方向变 |
| **小** | 同方向新模块或重要能力 |
| **修改** | 同小版本内迭代修补 +1 |

可选分支名：`YYYY-MM-DD-v大.小.修改`。  
正式 Tag：**`v数字.数字.数字`**（如 `v1.10.31`）。  
过程 Tag（`stage/`、`nest/`）≠ 正式发版文案。

### 2.2 发版顺序（必须按序）

```
Release:
- [ ] 0. 发版前测试（见下）——未过不打 tag
- [ ] 1. 功能已验证；migration 文件已进仓（若有）
- [ ] 2. 写 CHANGELOG.md 顶条（中文，按能力点列）
- [ ] 3. 同步 package.json version（与 tag 去掉 v 后一致）
- [ ] 4. git status / diff / log 确认范围
- [ ] 5. commit（用户要求时）
- [ ] 6. **先** git tag vX.Y.Z，再 git push + **git push origin vX.Y.Z**
- [ ] 7. **然后** MCP publish_release（勿与 push tag 并行，以免远程抢建错位 tag）
- [ ] 8. 口头提醒：Supabase 执行新 migration（若有）
```

**顺序铁律**：本地 tag → push commit → push tag → 再 `publish_release`。不要并行。

#### 发版前测试（最低门槛）

测试要对齐用户的**初始要求**（及已写入 PM 的条目），不是只看「类型能过」。

1. **对照验收**：把初始要求 / PM 里的目标点成清单，逐条确认做到了；缺的标出来，勿假装完成  
2. **相关单测**（若本版动到对应模块）：如 `npx tsx lib/requirement-status.test.ts`  
3. **`npx tsc --noEmit`**（类型检查必须过）  
4. 有 UI 关键改动时：本地或预览点主路径冒烟  
5. 勿把「我觉得没问题」当测试；失败先修再发版  

纯文案 / 仅 skill·规则改动：确认路径正确即可；顺带改了 ts 仍建议 `tsc`。

### 2.3 CHANGELOG 写法

```markdown
## vX.Y.Z · YYYY-MM-DD

- **能力名**：一句话用户能懂的结果（不是文件列表）
- **能力名**：…
```

- 正文中文；Tag 名英文 `vX.Y.Z`  
- 写「做了什么结果」，少写「改了哪个 ts」  
- 与本版演进 `module` 能对上更佳

### 2.4 Git 操作细则

| 动作 | 规范 |
|------|------|
| commit | 仅用户要求； HEREDOC/`-m` 清晰；不 commit 密钥/`.env` |
| tag | 轻量 annotated 或轻量 tag 均可；名必须 `vX.Y.Z` |
| push | `git push` 与 `git push origin vX.Y.Z` 分开；需用户明确 |
| publish_release | 在 tag 已存在（或即将由该工具创建 Release）且演进尽量带 module 后调用 |
| 禁止 | `push --force` 到 main/master；改 git config；`--no-verify`（除非用户要）；乱改历史 |

「同步 Git 更新」= commits；「同步版本」= Tag/Release；**都不等于** `publish_release`。

### 2.5 publish_release

- 汇总**带 module** 的演进写入 GitHub Release body（中文）  
- 默认把未挂版本且有板块的演进挂到本 tag  
- Star PM：`projectId=proj-star-pm`，`tag=vX.Y.Z`  
- 其它挂了 `githubRepo` 的项目同理

### 2.6 发版后检查

- [ ] GitHub Release 页面打开正常  
- [ ] CHANGELOG 与 Release 要点一致  
- [ ] 新 SQL migration 已提醒用户在 Supabase 跑  
- [ ] 相关演进 `releaseTag` 已挂上（或由 publish 挂上）

---

## 3. 默认 projectId

| 产品 | projectId |
|------|-----------|
| Star PM | `proj-star-pm` |
| 随心而行 | `proj-moonpie` |
| 不确定 | `list_projects` / `search` |

---

## 4. 禁止

- 未确认发版 → 不 `publish_release` / 不打 tag / 不 push tag  
- 未要求 commit → 不 commit  
- 缺板块 → 标待补齐，不静默丢  
- 无聊天时间戳 → 不编造工时  
- 演示沙盘 MCP → 不写真实私域（需管理员会话）  
- 多源未对齐 → 不大范围覆盖写文件  

---

## 5. MCP 速查

| 动作 | Tool |
|------|------|
| 规则 | `get_ai_rules` |
| 比版本 | `compare_sources` |
| 开改 / 收工 | `start_change_session` / `finish_change_session` |
| 演进 / 决策 | `add_evolution` / `add_decision` |
| 灵感 | `capture_idea` / `update_idea` |
| 发版 | `publish_release` |
| CHANGELOG→演进 | `import_changelog_evolution` |

仓库规则正文：`docs/ai/CANONICAL_RULES.md`（改规则只改那份，再发版）。
