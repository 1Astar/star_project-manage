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

| 字段 | 要求 |
|------|------|
| **板块** `module` / `relatedModule` | **强烈建议必填**。Star PM 默认：工作台 / 项目库 / 灵感 / 需求任务 / 迭代记录 / 资源中心 / Git / 设置 |
| **原因** `reason` | 可空；空则弱提醒 |
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

## 5. 接入清单（指针）

| 入口 | 如何读到本规则 |
|------|----------------|
| Cursor | `.cursor/rules/star-pm-ai.mdc` → 指向本文件 |
| Codex / Agent | `AGENTS.md` 顶部必读本文件 |
| MCP | 工具 **`get_ai_rules`**；写操作描述要求先读 |
| ChatGPT Action | System / OpenAPI 说明：先调 `get_ai_rules` |

改规则只改本文件，再发版；各入口无需抄正文。
