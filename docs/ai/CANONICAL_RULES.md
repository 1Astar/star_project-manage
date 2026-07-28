# Star PM · AI 统一规则（Canonical）

> **唯一正文。** Cursor / Codex / MCP / ChatGPT Action 只应引用本文件，勿复制多份以免漂移。  
> 路径：`docs/ai/CANONICAL_RULES.md` · MCP：`get_ai_rules`

---

## 1. 动手前：比版本（防覆盖）

改代码或大范围写文件前，先调用 MCP **`compare_sources`**（或站内等价检查），对比：

1. **Git**（`githubRepo` + `githubBranch` 最新 commit）  
2. **Vercel**（production 部署，若配置了 `VERCEL_TOKEN`）  
3. **Studio 记录**（项目上的 `lastCommitSha` / `lastGitSyncedAt`）

| 结果 | 动作 |
|------|------|
| 三方一致 / 可判定 newest | 在最新基线上改 |
| Git 领先 | 先 pull / 以 Git 为准再改 |
| Vercel 领先于 Git | **先把线上同步回 Git**，再改；禁止用旧本地覆盖 |
| 本地/Studio 脏且落后 | 不要强推；先对齐再动手 |

未比对且已知可能分叉时，禁止整仓覆盖式写入。

---

## 2. 写入规范（灵感 / 演进 / 决策）

**有则写之，无则跳过**——对话里有的字段写入；没有的不要编造。清单与发版步骤见 Agent Skill `star-pm-write-release`。

| 字段 | 要求 |
|------|------|
| **板块** `module` / `relatedModule` | **有则写 / 强烈建议**。可用项目自定义 `featureModules`（如 `六爻·笔记·卦象解析`）；未配置时 Star PM 默认：工作台 / 项目库 / 灵感 / 需求任务 / 迭代记录 / 资源中心 / Git / 设置。MCP 用 `update_project.featureModules` 覆盖写入；写入时按「·」增量同步到需求模块树（一级=首段，子模块=其余） |
| **原因** `reason` | 有则写；空则弱提醒 |
| **版本** `releaseTag` | 可选；发版前用 `publish_release` 挂上 |

MCP 写入缺板块会返回 `warning`，**不阻断**；导入缺板块 → 标记 **「待补齐·板块」** 仍可入库。

发版：用 **`publish_release`**，按板块汇总后创建 GitHub Release（Tag 名可用英文 `vX.Y.Z`，正文用中文）。

---

## 3. 导入规范

- Notion / Excel / MCP capture 共用校验逻辑。  
- **缺板块：进入「待补齐」**（笔记标记 `【待补齐·板块】`），**仍允许导入**。  
- 预览/结果中返回 `pendingModuleFill` 列表，便于事后补全。  
- 不要静默丢掉不合规字段；能进库的进库，缺的标出来。

---

## 4. 版本与 Tag

- 「同步 Git 更新」= **commits**，不是发版说明。  
- 「同步版本」= **Tag / Release**；无 Release body 时用 commits 补「本版变更」。  
- `stage/`、`nest/` 等过程 Tag 是技术标记，不是中文产品文案；正式发版优先 `v数字.数字…`。

---

## 5. 协作节奏（讨论 → 开做）

**审慎：** 不要假设用户已非常清楚想要什么、以及该怎么得到。从**原始需求和问题**出发。

1. 动机 / 目标 / 成功标准 **不清晰 → 停下来讨论**（先细问再做；不必写 spec）  
2. 发现 **逻辑漏洞或不明确** → **必须提醒用户**，不可默默用猜测填平  
3. 方案须 **逻辑正确**，并做 **全链路逻辑验证**（问题 → 方案假设 → 数据/状态 → 验收 → 发版影响）  
4. **计划 / 项目需求直接写进 Star PM**（有则写之，无则跳过）  
5. 对齐后 **开做**；默认不写 `docs/superpowers/specs/*`（除非用户明确要设计文档）  
6. **验收 / 发版前**：对照初始要求 + 全链路核对，再跑技术检查  

口头对齐可以；长篇设计文档默认跳过。

---

## 6. 接入清单（指针）

| 入口 | 如何读到本规则 |
|------|----------------|
| Cursor | `.cursor/rules/star-pm-ai.mdc` → 指向本文件 |
| Codex / Agent | `AGENTS.md` 顶部必读本文件 |
| MCP | 工具 **`get_ai_rules`**；写操作描述要求先读 |
| ChatGPT Action | System / OpenAPI 说明：先调 `get_ai_rules` |

改规则只改本文件，再发版；各入口无需抄正文。

---

## 7. 操作清单（指针）

**AI 写入字段标准、ChangeSession/工时、git tag / CHANGELOG / `publish_release` 逐步清单**  
见 Agent Skill：`star-pm-write-release`（勿把长清单复制进本文件）。
