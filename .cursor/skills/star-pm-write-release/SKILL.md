---
name: star-pm-write-release
description: >-
  Star PM AI 写入标准与发版规范：灵感/需求记忆字段写全（标题类型项目产生时间聊天主题
  原始想法 AI补充 为什么 状态 优先级 下一步）、新需求写产生时间、续作写 timeline、
  完成写完成时间；做完勾完成并把「下一步」写成下一条要接的需求（仍有未完成则必写必说）；
  插队搁置须归队；不做/后期说清防双盲；ChangeSession/演进/板块；
  CHANGELOG+git tag+publish_release；发版前对比前一版、按方向分版、记录必有。
  Use when writing to Star PM, 记需求, 捕捉灵感, 更新灵感字段, 下一步, 优先级 P0/P1/P2,
  发版, release, 对比上一版, 分方向迭代, 插队, 接下来做什么, or finishing work that must be logged to the planet.
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

**审慎原则（硬规则）**

- **不要假设**用户已经非常清楚自己想要什么、以及该怎么得到。  
- **从原始需求和问题出发**，先对齐动机与目标，再谈方案与实现。  
- 动机 / 目标 / 成功标准 **不清晰 → 停下来和用户讨论**，问清再做（一次一问或少量关键项）。  
- 发现 **逻辑漏洞、矛盾、缺前置条件、边界不清** → **必须提醒用户**，不要默默用自己的猜测填平。  
- 方案必须 **逻辑正确**，并做 **全链路逻辑验证**（从原始问题 → 方案假设 → 数据/状态流转 → 验收标准 → 发版影响），验证不过不宣称可做完/可发版。

其余节奏：

1. **不写** `docs/superpowers/specs` / 长篇设计文档 / 单独 plan 文件（除非用户明确要）。  
2. **计划与项目需求直接写进 PM**（有则写之，无则跳过）。  
3. **开新项目 / 新能力前**：先看一下 GitHub 上有没有能直接复用的项目，或者能部分拿来用的；向用户交代候选与取舍后再从零搭（细则见 `using-star-skills`「GitHub 复用检索」）。用户明确跳过检索时可省略。  
4. 改代码前：MCP **`compare_sources`**。  
5. 用户与方案对齐后 → **写进 PM → 开做**。  
6. **改任何文件前**：检查用户是否已修改；**用户改过则必须在其保存版上再改**，禁止用旧稿整份覆盖（细则见 `version-management`）。

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

给人验收看的，**禁止只写工程黑话**（文件名 / lore / 单测）。验收人要一眼知道：哪个大/小板块、大运（或功能）**变了什么**、**用户会感知到什么**。

**start_change_session**

| 字段 | 要求 |
|------|------|
| `projectId` | 必填（见 §4） |
| `module` | **必填口径**：`大板块·小板块…`（`·` 分层）。例：`八字·图鉴·大运流年` → 大=八字，小=图鉴·大运流年。缺则进「未分板块」 |
| `goal` | 必填：**人话**修改目标（「统一大运/流年解释文案」✓；「落地 luck-lore」✗） |
| `reason` | **必填**：为什么现在改 + **对用户影响**（一到两句） |
| `expected` | **必填**：怎么验，写成用户路径（「打开图鉴→…」「打开造命→…」），2～5 条 |
| `startedAt` | **本轮对话最早用户消息**时间戳 ISO |

**finish_change_session**

| 字段 | 要求 |
|------|------|
| `doneItems` / `pendingItems` | ✅ / ❌ 用产品语言拆开；工程细节放 `aiOps` |
| `aiOps` | 改了哪些文件（可略读，不进验收主叙事） |
| `result` | **用户能感知到什么** + 明确「没改什么」（例：文案统一了，Buff 数值没改） |
| `finishedAt` | **本轮对话最后相关消息**时间戳 ISO |
| `acceptancePolicy` | 见下节「人工验收」 |

工时：不叫「AI 工时」产品名；就是开始–结束。条目有时段，板块表可 Σ。

收工自检（不过不宣称可验）：
1. 板块路径能拆出大/小吗？  
2. 不懂代码的人读 goal/reason/result 能懂吗？  
3. expected 是可点路径，不是「单测通过」？

### 1.3.1 人工验收（按板块汇总 + A+B+C，硬规则）

**目的**：不忘「为啥做 / 做完没」；AI 收工后人闸。工作台「待你验收」按 **项目 × 板块路径**（`大·小`）汇总成卡，不按会话堆。

收工 `finish_change_session` **必带**：`module`（`大·小`）、人话 `goal`/`reason`（含用户影响）/`expected`（用户路径怎么验）/`result`（用户感知+没改什么）、`acceptancePolicy`。

| 策略 | 何时 | `acceptancePolicy` | 结果 |
|------|------|-------------------|------|
| **A 默认提醒** | **产品行为变化** / 不确定 | `remind` 或省略（非小修） | `unreviewed` → 并入板块汇总卡（**收工不 Push**）；**用户整板块或单条点通过** |
| **B 用户免验** | 用户明确说「这次不用我验 / 直接过 / 免验」 | **`user_waived`** | 标 `passed` |
| **C 小修** | 纯修复、hotfix、文案/样式、**文档 / skill / changelog**，且 `pendingItems` 空 | **`auto_pass_small`**（或启发式） | 标 `passed`（收工不 Push） |

补充闭环：

1. 缺 `module` → 进 **「未分板块」** + warning，禁止瞎填。  
2. 用户验收打回或口述 bug/优化 → **立刻记入 PM**（`create_bug`），挂板块/会话。  
3. AI 做完补充 → 再 `finish_change_session`（小修用 C；行为变化用 A）。  
4. **禁止**对大功能静默 `humanAcceptance=passed`。  
5. **推送节奏（硬）**：**日常 `finish_change_session` 不发 PushPlus**（只进工作台待验）。**正式 `publish_release` 成功后**再汇总推一条（本版板块 + 说明摘要 + Release/工作台链接）。`draft` 发版默认不推。  
   **定时推送（上海时区）**：每天 **09:00** 早报（今日要做/推荐）；每天 **18:30** 晚报（待验收板块汇总）。空队列默认不推。  
6. **发版门禁**：`publish_release` 若该项目仍有未验板块（含未分板块）则失败；`draft` 或用户明确要求时用 `forceSkipAcceptance=true`。

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
| **优先级** | `priority` | 有则写，无则跳过（勿默认瞎标 P1）。P0/P1/P2… 表示**当前该啃的工作级**，不是 git 版本号 |
| **下一步建议** | `suggestedNextStep` | 有则写，无则跳过。**迷茫时先读这条**——不知道做什么就看 Idea 的「下一步」 |

板块 `relatedModule`：有则写 / 可推断则推断；推断不出可标待补齐。其余同 **有则写之，无则跳过**。

#### 工作节奏：做完 → 勾完成 → 写清「接下来接什么」（硬规则）

适用于灵感 / 需求记忆（Idea）及已同步的需求池条目：

1. **做完**当前「下一步」对应的事项（可验收）。  
2. **勾完成**：状态推进到完成（或看板规范中的下一合法态）；该勾的完成项写上 **完成时间** `completedAt`。  
3. **改「下一步」**：把 `suggestedNextStep`（及必要时 `priority`）改成**下一级 P / 下一条要啃的需求**——不要停在已做完的描述上。  
4. **仍有未完成需求时（硬）**：收工时**必须**写清并当面告知用户——**接下来要继续做什么需求**（标题 + Idea/需求 ID 更好）。只记在 PM、聊天里不说 → 不够；只口头、不写进 `suggestedNextStep` → 也不够。两边都要有。  
5. **不知道做什么时**：打开相关 Idea，只看 **下一步建议**；**当前约定以 P2 为准**（若卡片上已写明当前 P，以卡片为准）。若「下一步」空或过期 → **先补写再开做**，禁止双方陷入「都不知道要做什么」。  
6. **勿混淆**：`priority` / 下一步的 P0·P1·P2 ≠ `version-management` 里的软件 vX.Y.Z，也 ≠ CHANGELOG 发版号。

收工写 PM 时：ChangeSession 的 `doneItems` 勾清；同步 Idea 的状态与下一步（本条）；回复用户时用一两句点名**下一条接续需求**。

#### 插队需求 · 原计划搁置 · 做完再归队（硬规则）

常见：Agent 已规划/正要做需求 A；用户插入新需求 B；A 被搁置；B 做完后必须回到 A。

| 步骤 | 必须做 |
|------|--------|
| **插队当下** | 立刻把 A 的搁置写进 PM：状态/`parked` 或「下一步」注明「被 B 插队搁置；B 完成后接回」；挂上 A 的 ID。禁止只靠聊天记忆 |
| **开做 B** | B 的 `suggestedNextStep` / ChangeSession `pendingItems` 写明：**B 完成后 → 继续 A（标题+ID）** |
| **B 勾完成时** | **必须**把「接下来」改回 **A**（或用户当场改口的新顺序）；口头提醒用户「接回原先那条」；更新 A 为可开做态（从停车场捞出 / 恢复优先级） |
| **禁止** | B 做完就停、不问不写 → A 静默失踪；或把 A 当「新灵感」重提导致重复 |

多条被插队搁置时：用队列写清顺序（先 A 再 C…），收工只推进队首，其余仍写在「下一步/pending」里。

#### 本期不做 / 后期再做（硬规则）

用户或定稿出现 **不做、后期、先做 X 再补、延期、停车场** 时：

1. **必须**加载并遵守 skill **`defer-scope-record`**（延期卡；**挂父下子节点**；**同批提出的子项平等记账、勿厚此薄彼**）。  
2. 每项「不做/后期」落 **子** Idea（`parked`）+ 尽量落 **子** 需求（`parentId`）；同批条目同规格写满，禁止只留聊天或只写其中一条。  
3. **禁止**把仍含未做后期子项的整包标 `done`；切片完成写清「已完成子项」。  
4. 用户确认「有没有记过后期」时：先搜**父需求树**，补齐**同批全部子节点**，勿当成现在开做、也勿只补被点名的一条。  
5. **说清楚，避免双盲（硬）**：本期做 / 本期不做 / 以后做 —— 三条在收工回复与 PM 里都要能扫到；做完切片后「接下来接什么」不能空。目标：**你和用户任何时候都知道下一步是什么**（或明确「暂无下一步、等某某信号」）。

造命「流月 Buff」释义见 `defer-scope-record`。

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
- [ ] 灵感/需求：勾完成 + 写清「接下来接什么」（仍有未完成则点名下一条；见 §1.5）
- [ ] 若有插队：归队原计划 / 更新搁置队列；不做·后期条目已说清（见 defer-scope-record）
```

---

## 2. Git 发版规范

仅在用户明确说 **发版 / release / 打 tag / 发布**，或说 **差不多了 / 做完了可以发** 时执行。  
**默认节奏：一个方向的需求做完并验证过 → 就发一版**（不必把多个无关方向攒成一大包；同方向小修升「修改次数」即可）。  
未要求 **commit** 不要 commit；未要求 **push** 不要 push。

### 2.0 发版前对比 · 按方向分版（硬规则）

发版不只是打 tag，还必须能说清「相对上一版变了什么、本版只装哪一条线」。

| 要求 | 怎么做 |
|------|--------|
| **与前一版对比** | 发版前对照上一正式 Tag / 上一版 CHANGELOG / 相关演进：本版新增、修改、未动范围写清楚；禁止「糊成一坨变更」无法复盘 |
| **不同方向分版** | **不同产品方向、不同修改主题、不同需求线** → 尽量放进**不同版本迭代**（升小版本或分别打修订版），不要把互不相关的几条线塞进同一 Release body |
| **一方向一发（优先）** | 每完成**一个方向**的需求（可验收）→ **优先单独发一版**；便于对照、回滚叙事、PM 勾完成与 `shippedSuggestions` 对上 |
| **记录必有** | 每版必须有可追溯记录：CHANGELOG 顶条 + 相关 Evolution（带 `module`）+ 关联需求/Idea 状态与完成时间；口头说过不算数 |

例外（仍要记录）：用户明确要求「这几条无关改动合并发一版」→ 在 CHANGELOG / 演进里**分条写清各方向**，并在 PM 决策/会话注明「合并发版原因」。

与版本号段的对应：方向级变化偏升 **小**（或 **大**）；同方向修补升 **修改**。细则见 `version-management`。

### 2.1 版本号

格式：`v大.小.修改`（与 `package.json` / `CHANGELOG.md` 一致）

| 段 | 何时升 |
|----|--------|
| **大** | 产品定位 / 核心结构方向变 |
| **小** | 同方向新模块或重要能力；或开启另一条需求方向的版本切片 |
| **修改** | 同小版本内迭代修补 +1 |

可选分支名：`YYYY-MM-DD-v大.小.修改`。  
正式 Tag：**`v数字.数字.数字`**（如 `v1.10.31`）。  
过程 Tag（`stage/`、`nest/`）≠ 正式发版文案。

### 2.2 发版顺序（必须按序）

```
Release:
- [ ] 0. 与前一版对比 + 本版方向边界写清（见 §2.0）——混方向未拆清先问用户
- [ ] 1. 发版前测试（见下）——未过不打 tag
- [ ] 2. 功能已验证；migration 文件已进仓（若有）
- [ ] 3. 写 CHANGELOG.md 顶条（中文，按能力点列；相对上一版可扫）
- [ ] 4. 同步 package.json version（与 tag 去掉 v 后一致）
- [ ] 5. git status / diff / log 确认范围（相对上一 tag）
- [ ] 6. commit（用户要求时）
- [ ] 7. **先** git tag vX.Y.Z，再 git push + **git push origin vX.Y.Z**
- [ ] 8. **然后** MCP publish_release（勿与 push tag 并行，以免远程抢建错位 tag）
- [ ] 9. PM 记录核对：演进/需求完成时间/下一步已推进；口头提醒 Supabase migration（若有）
```

**顺序铁律**：本地 tag → push commit → push tag → 再 `publish_release`。不要并行。

#### 发版前测试（最低门槛）

测试要对齐用户的**初始要求 / 问题动机**（及已写入 PM 的条目），并完成 **全链路逻辑核对**，不是只看「类型能过」。

1. **对照验收**：初始要求 → 方案假设 → 主路径行为 → 验收标准，逐条确认；缺的标出来  
2. **相对前版**：本版声称的能力点 vs 上一 Tag/CHANGELOG，diff 与文案一致  
3. **逻辑提醒**：若链路有洞（缺状态、缺数据源、成功标准矛盾）→ 先提醒用户，再决定是否仍发版  
4. **相关单测**（若本版动到对应模块）  
5. **`npx tsc --noEmit`** 必须过  
6. 有 UI 关键改动时：主路径冒烟  
7. 勿把「我觉得没问题」当验证；失败先修再发版  

### 2.3 CHANGELOG 写法

```markdown
## vX.Y.Z · YYYY-MM-DD

- **能力名**：一句话用户能懂的结果（不是文件列表）
- **能力名**：…
```

- 正文中文；Tag 名英文 `vX.Y.Z`  
- 写「做了什么结果」，少写「改了哪个 ts」  
- 与本版演进 `module` 能对上更佳  
- **相对上一版可读**：读者应能看出本版相对 `v前一版` 多了/改了什么；多方向被迫同发时按方向分条，勿混成一段

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
- 返回 **`shippedSuggestions`**：按本版 CHANGELOG 条目 + 已挂 tag 的演进，模糊匹配未完成需求（**仅建议，不改状态**）  
- 确认后调用 **`confirm_shipped_requirements`**（`requirementIds` + 建议的 `completedAt`）  
- 每日 **`sync-git`** 后另有 commit→需求建议：用 **`list_git_sync_suggestions`** / **`confirm_git_sync_suggestions`**（同样不自动改状态）  
- 每日 **`sync-git`** 后另有 commit→需求建议：用 **`list_git_sync_suggestions`** / **`confirm_git_sync_suggestions`**（同样不自动改状态）  
- 也可单独调 **`suggest_shipped_from_release`**

### 2.6 发版后检查

- [ ] GitHub Release 页面打开正常  
- [ ] CHANGELOG 与 Release 要点一致  
- [ ] 新 SQL migration 已提醒用户在 Supabase 跑  
- [ ] 相关演进 `releaseTag` 已挂上（或由 publish 挂上）  
- [ ] 查看 `shippedSuggestions.candidates`；该标完成的用 `confirm_shipped_requirements` 确认  

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

## 5. MCP 接入与速查

**端点（生产）**：`https://star-project-manage.vercel.app/api/mcp`  
鉴权：HTTP Header `Authorization: Bearer <token>`（管理员作用域；无 Bearer → 演示沙盘，**禁止写真实私域**）。  
**密钥只放本机配置 / 环境变量，禁止写入 skill、仓库、聊天记录。**

### 5.1 Cursor（`~/.cursor/mcp.json`）

```json
{
  "mcpServers": {
    "star-pm": {
      "url": "https://star-project-manage.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_TOKEN>"
      }
    }
  }
}
```

Cursor 里服务器名常显示为 `user-star-pm` / `star-pm`。仓库模板：`.cursor/mcp.json.example`。

### 5.2 Codex（`~/.codex/config.toml`）

用环境变量挂 Bearer（推荐名 `STAR_PM_MCP_TOKEN`）：

```bash
codex mcp add star-pm --url https://star-project-manage.vercel.app/api/mcp --bearer-token-env-var STAR_PM_MCP_TOKEN
```

等价 TOML：

```toml
[mcp_servers.star-pm]
url = "https://star-project-manage.vercel.app/api/mcp"
bearer_token_env_var = "STAR_PM_MCP_TOKEN"
```

本机用户环境变量设好 `STAR_PM_MCP_TOKEN` 后重启 Codex。  
ChatGPT 网页 Custom GPT：走 OAuth 路径 `/api/mcp-oauth/mcp`（与 Cursor Bearer 不同），见产品文档；本 skill 默认指 Cursor/Codex Bearer。

### 5.3 工具速查

大批量写入前先 `get_ai_rules`。

| 动作 | Tool |
|------|------|
| 规则 | `get_ai_rules` |
| 比版本 | `compare_sources` |
| 开改 / 收工 | `start_change_session` / `finish_change_session` |
| 演进 / 决策 | `add_evolution` / `add_decision` |
| 灵感 | `capture_idea` / `update_idea` / `get_idea` / `list_ideas` |
| 项目 | `list_projects` / `get_project` / `update_project` |
| 需求 | `list_requirements` / `create_requirement` / `update_requirement` / `create_task` / `list_tasks` / `update_task` / `delete_task` |
| 迭代期 | `list_iterations` / `create_planning_iteration` / `align_project_periods` |
| Bug | `create_bug` / `list_bugs` / `get_bug` / `update_bug` / `update_bugs` / `add_bug_comment` / `delete_bug` |
| 发版 | `publish_release` |
| CHANGELOG→演进 | `import_changelog_evolution` |

会话未刷新时桥接（经已挂载的 `create_task`）：

- Bug：`progressNote` 首行 `__CREATE_BUG__`
- 期次+工时对齐：`progressNote` 首行 `__ALIGN_PERIODS__`（可选次行 JSON `{dryRun,fillHours}`）

仓库规则正文：`docs/ai/CANONICAL_RULES.md`（改规则只改那份，再发版）。
