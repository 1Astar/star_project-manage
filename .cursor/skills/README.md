# Star PM · Agent Skill 库索引

路径：`工具/private/工具/star_project-manage/.cursor/skills/`  
总入口 skill：`doc-delivery-formats`  
开场必查：`using-star-skills`  
写入/收工节奏：`star-pm-write-release`（含 Idea「下一步 → 下一级 P」）

---

## 0. 跨窗口怎么用上（必读）

| 机制 | 作用 |
|------|------|
| `C:\Users\l1397\.cursor\skills\<name>` → 本目录 junction | **任意 Cursor 窗口**的 Agent 都能加载这些 skill |
| `E:\文档\star\.cursor\skills\` → 同上 | 本仓库窗口也能从项目路径发现 |
| `E:\文档\star\.cursor\rules\skill-first.mdc`（alwaysApply） | **行动前**强制先查 skill |
| `C:\Users\l1397\.cursor\rules\skill-first.mdc` | 其它项目窗口同样提示先查 |

**Agent 硬规则：** 动手前先扫 skills；Star 交付类任务先读本 README，再 Read 对应 `SKILL.md`。

重挂载（换机/目录坏了）可跑：同目录 `_link_skills.py`。

---

## A. 本仓库内 Skill（优先加载）

| Skill | 何时用 | 本地路径 |
|-------|--------|----------|
| **using-star-skills** | **开场 / 行动前**：判断该用哪些 Star skill；**开新项目前先扫 GitHub 复用** | [using-star-skills/SKILL.md](./using-star-skills/SKILL.md) |
| **doc-delivery-formats** | 文档格式总入口、写作原则、Canvas 限制 | [doc-delivery-formats/SKILL.md](./doc-delivery-formats/SKILL.md) |
| **star-pm-write-release** | 写 PM、灵感字段、做完勾完成、下一步改 P、发版 | [star-pm-write-release/SKILL.md](./star-pm-write-release/SKILL.md) |
| **defer-scope-record** | **本期不做/后期再做**必须写清：是什么、为什么不做、后期怎么做 | [defer-scope-record/SKILL.md](./defer-scope-record/SKILL.md) |
| **word-docx-professional** | 生成专业 Word（Node + docx） | [word-docx-professional/SKILL.md](./word-docx-professional/SKILL.md) |
| **ppt-consulting-visual** | 科技蓝咨询风 PPT + 纸感美化 | [ppt-consulting-visual/SKILL.md](./ppt-consulting-visual/SKILL.md) |
| **product-scheme-design** | 产品/项目方案设计书结构 | [product-scheme-design/SKILL.md](./product-scheme-design/SKILL.md) |
| **version-management** | 文档三位版本 / 软件 git 发版号 | [version-management/SKILL.md](./version-management/SKILL.md) |
| **safe-file-delete** | 删文件硬约束 | [safe-file-delete/SKILL.md](./safe-file-delete/SKILL.md) |
| **brainstorming**（指针） | 创意/方案前先对齐意图 | [brainstorming/SKILL.md](./brainstorming/SKILL.md) |
| **canvas**（指针） | Cursor Canvas 分析页 | [canvas/SKILL.md](./canvas/SKILL.md) |
| **verification-before-completion**（指针） | 宣称完成前必须验证 | [verification-before-completion/SKILL.md](./verification-before-completion/SKILL.md) |
| **create-skill**（指针） | 新建/改写 Agent Skill | [create-skill/SKILL.md](./create-skill/SKILL.md) |

权威 AI 规则正文（非 skill，但必读）：  
`docs/ai/CANONICAL_RULES.md` · MCP `get_ai_rules`

---

## B. 当前常用外部 Skill（指针，正文在原路径）

| Skill | 用途 | 绝对路径 |
|-------|------|----------|
| brainstorming | 创意前对齐 | `C:\Users\l1397\.codex\skills\brainstorming\SKILL.md` |
| writing-plans / executing-plans | 实现计划 | `C:\Users\l1397\.codex\skills\writing-plans\SKILL.md` |
| verification-before-completion | 完成前验证 | `C:\Users\l1397\.codex\skills\verification-before-completion\SKILL.md` |
| using-superpowers | 开场检查该用哪些 skill | `C:\Users\l1397\.codex\skills\using-superpowers\SKILL.md` |
| guizang-ppt-skill | 横向翻页网页 PPT | `C:\Users\l1397\.codex\skills\guizang-ppt-skill\SKILL.md` |
| ppt-master | 文档→SVG→PPTX | `C:\Users\l1397\.codex\skills\ppt-master\SKILL.md` |
| canvas | Cursor Canvas SDK | `C:\Users\l1397\.cursor\skills-cursor\canvas\SKILL.md` |
| create-skill | 编写 Cursor skill | `C:\Users\l1397\.cursor\skills-cursor\create-skill\SKILL.md` |

咨询风商业 PPT 优先用本库 **`ppt-consulting-visual`**；杂志风/多页 SVG 再用 guizang / ppt-master。

---

## C. 相关交付物链接（本轮水泵新方向）

| 资料 | 路径 |
|------|------|
| 调研 Word 成稿 | `E:\文档\star\产品\CLEDIC\文档\市场调研报告\新方向调研\水泵新方向调研_企业系统拆解与政策窗口_20260803.docx` |
| Canvas（无图片组件，结构化扫读） | `C:\Users\l1397\.cursor\projects\e-star\canvases\water-pump-new-direction.canvas.tsx` |
| 通用控制器既有报告 | `E:\文档\star\产品\CLEDIC\文档\市场调研报告\通用智能控制器市场调研与产品方案报告.docx` |

关联项目建议：`proj-c84ff6fa` 元井水泵 · `proj-ai-controller` AI 控制器 · `proj-star-pm`（skill 库本体）

---

## D. 工作节奏速记

1. **开场** → `using-star-skills`：先判断有没有 skill 可用  
2. 不知道做什么 → 看 Idea **下一步**（当前默认 **P2**，以卡片为准）；空了就先补写  
3. 做完 → **勾完成** → **写清并当面说「接下来接哪条需求」**（仍有未完成时必做）  
4. **插队**：新需求插入时原计划写搁置；新需求做完必须**归队**原计划  
5. **不做 / 后期** → `defer-scope-record` 写清，避免双盲  
6. 文档交付 → 只放成品；格式走 `doc-delivery-formats` 路由  
7. 删文件 → `safe-file-delete`  
8. **改文件前检查用户是否已修改；用户改过则在修改过的基础上再改**（`version-management`）  
9. **文档小修改不新建文件**；**小版本 / 大版本迭代才新增带版本号的文件**（`version-management`）  
10. **发版**：先对比前一版；不同方向/修改/需求尽量分不同版本；**优先一方向一发**；CHANGELOG + PM 记录必有（`star-pm-write-release` §2.0）
