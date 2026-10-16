# Star PM Plugin（Cursor + ChatGPT）

把 **私有 skill 库** + **Star PM MCP tools** 打成一份可安装包。

| 宿主 | 装什么 | Tools |
|------|--------|-------|
| **Cursor** | 本目录作 Cursor Plugin（skills + rules + MCP） | Bearer → `/api/mcp` |
| **ChatGPT** | Custom GPT：`gpt/INSTRUCTIONS.md` + Knowledge + Connector | OAuth → `/api/mcp-oauth/mcp` |

灵感已记：`idea-9b0d4281`（proj-star-pm）。

---

## Cursor 安装

### A. 本地 / 私有（推荐本机）

1. Cursor → **Settings → Plugins / Customize** → 从本地文件夹或 Git 安装本目录 `plugins/star-pm`  
2. Configure → 填 **`STAR_PM_MCP_TOKEN`**（只要 token，不要 `Bearer ` 前缀）  
3. 重载 Agent；应看到 skills（如 `using-star-skills`）且 MCP `star-pm` 可用  
4. 冒烟：让 Agent 调 `list_projects`，应出现 **NAS** 等项目  

若商店安装不可用，可临时：

```bash
# 仍可用旧方式挂 skills
bash .cursor/skills/_link_skills_mac.sh
# MCP 继续用 ~/.cursor/mcp.json
```

### B. Marketplace（公开前）

仓库公开 + [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish) 提交；**不要**把 token 写进仓库。

---

## ChatGPT 安装

见 [`gpt/CONNECT_CHATGPT.md`](./gpt/CONNECT_CHATGPT.md)。

1. 新建 Custom GPT  
2. Instructions ← [`gpt/INSTRUCTIONS.md`](./gpt/INSTRUCTIONS.md)  
3. Knowledge ← 上传 `gpt/knowledge/*`  
4. Connector ← `https://pm.starry-studio.cn/api/mcp-oauth/mcp`  

---

## 含哪些 skill

由 `.cursor/skills` 同步（外加 `starpm-method`）。更新后跑：

```bash
bash plugins/star-pm/scripts/sync-from-repo.sh
```

指针类 skill（brainstorming / verification）在插件内已换成**可移植全文**；`canvas` / `create-skill` 同步时优先用本机 `~/.cursor/skills-cursor` 正文。

---

## 目录

```text
plugins/star-pm/
├── .cursor-plugin/plugin.json   # Cursor manifest + token 变量
├── mcp.json                     # 生产 MCP URL + ${STAR_PM_MCP_TOKEN}
├── skills/                      # 私有 skill 库副本
├── rules/                       # alwaysApply：先查 skill
├── gpt/                         # ChatGPT Instructions + 连接说明 + knowledge
├── portable-overlays/           # 同步后覆盖指针 skill
├── scripts/sync-from-repo.sh
└── README.md
```

---

## 安全

- Token / OAuth 只放本机 Configure 或 ChatGPT 授权，**禁止进 Git**  
- 本插件 `license: UNLICENSED`：含私有 skill，默认**不要**公开 Marketplace，除非你先拆出公开 Method 子集（见 `method/starpm-skill`）
