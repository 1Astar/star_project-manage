# MAS 宿主 · 「项目管家」员工

目标：在 MAS 里创建员工，加载 **StarPM Skill**，连接 **StarPM MCP**，跑通 Capture / Change / Recover。

## 入口链接（有）

| 用途 | 链接 |
|------|------|
| **Skill 独立仓（推荐给 MAS 导入）** | https://github.com/1Astar/starpm-method |
| Skill 在父仓镜像路径 | https://github.com/1Astar/star_project-manage/tree/main/method/starpm-skill |
| MAS 官网 / 服务 | https://mas.shuzhiren.com |
| 浏览器试用（H5） | https://mas.shuzhiren.com/mobile/ |
| Android App | https://mas.shuzhiren.com/apk/latest.apk |
| 内网服务地址（介绍稿） | `http://218.64.194.89:5009`（登录填「服务地址」） |
| StarPM MCP（生产门） | `https://star-project-manage.vercel.app/api/mcp` |
| StarPM 站（核对是否写入） | https://star-project-manage.vercel.app |

登录 MAS：账号 + 密码 + **服务地址**（公网 `https://mas.shuzhiren.com`，内网按部署）。

StarPM MCP：Header `Authorization: Bearer <STAR_PM_MCP_SECRET>`。  
**密钥只放 MAS 后台 / 本机，勿进公开仓或聊天。**

---

## 架构

```text
MAS「项目管家」
    ├── Skill / 人设：starpm-method（SKILL.md）
    └── Tools：StarPM MCP → Core
```

---

## 在 MAS 上怎么挂

介绍稿（v1.9）口径：**Git Skill 库可导入含 `SKILL.md` 的仓库并分给员工**；**MCP 即插即用**。菜单名以你环境为准。

### A. 挂 Skill

1. **Git Skill 导入（优先）**  
   仓库：https://github.com/1Astar/starpm-method （根目录即 `SKILL.md`）  
   → MAS **技能 / Skill 库 / Git Skill** → 导入 → 分给「项目管家」。  
   父仓镜像：`method/starpm-skill/`（同内容，整仓偏 Core，不推荐当公开 Skill 源）。
2. **或粘贴**  
   新建员工 → 系统提示贴下方人设 → 知识库上传 `SKILL.md`（+ 可选 `EXAMPLES.md`）。

### B. 挂 MCP

1. 员工或租户的 **MCP / 工具 / 连接器**  
2. URL：`https://star-project-manage.vercel.app/api/mcp`  
3. Header：`Authorization: Bearer <TOKEN>`  
4. 对话里应能看到 `list_projects` / `capture_idea` 等  

若环境还没有 MCP UI：先只挂 Skill（输出 StarPM draft）；门通了再接 Core。

### C. 验收

对员工说 [`EXAMPLES.md`](./EXAMPLES.md) 三句 → 打开 StarPM 站看 **原始想法**是否原样入库。

---

## 可粘贴 · 员工人设

```text
你是「项目管家」，按 StarPM Method 工作：人用自然语言说，你负责识别项目、区分灵感与需求、保留原始原话、留下决策痕迹，并在有 MCP 时写入 StarPM。

硬规则：
1. 永远保留用户原话（Original Thought），润色只能写在 AI Interpretation。
2. 有证据才写字段；没有就跳过，不编造优先级或时间。
3. 含糊时先问清项目/意图（一次一问），再落库。
4. 随口火花 → Idea；已承诺要做 → Requirement；改优先级/不做 → Decision。
5. 已连接 StarPM MCP 时：用 capture_idea / create_requirement / update_requirement / add_decision / search / summarize_project 等工具真实写入。
6. 未连接或写入失败：输出「StarPM draft」结构化块，明确说尚未持久化，禁止假装已保存。

默认演示项目可用「晨光手记」。三流：Capture / Change / Recover。
```

---

## 本地材料

- `method/starpm-skill/SKILL.md`  
- `CONNECT_MCP.md`（与 MAS 同一 URL + Bearer）  
- 本文件：`MAS_HOST.md`

## 成功标准

Core 里 Idea/Decision 的 **原始想法非空且未被润色覆盖**。
