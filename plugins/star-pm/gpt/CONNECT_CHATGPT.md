# ChatGPT 连接 Star PM MCP

ChatGPT **不能**直接加载 Cursor `SKILL.md` 目录；做法是：

1. **Instructions** ← 粘贴 `INSTRUCTIONS.md`
2. **Knowledge**（可选）← 上传 `knowledge/` 下文件 + 需要的 skill 全文
3. **MCP / Connector** ← OAuth 路径（与 Cursor Bearer 不同）

## MCP 端点

| 宿主 | 路径 | 鉴权 |
|------|------|------|
| Cursor / Codex | `https://pm.starry-studio.cn/api/mcp` | `Authorization: Bearer <token>` |
| ChatGPT Connector | `https://pm.starry-studio.cn/api/mcp-oauth/mcp` | OAuth（DCR） |

## 在 ChatGPT 里加连接器

1. 设置 → 应用 / Connectors → 添加 MCP  
2. URL：`https://pm.starry-studio.cn/api/mcp-oauth/mcp`  
3. 按提示授权登录 Star PM  
4. 冒烟：让 GPT 调用 `list_projects`，应能看到 **NAS** 等私有项目  

### 「未知 client_id」

Connector 常缓存旧的 DCR `client_id`。处理：

1. 再点一次授权（服务端应对 `gpt_*` 自动恢复登记）  
2. 仍失败：删掉连接器 → 重新添加  
3. 备选：手动 OAuth 客户端 `client_id` = `star-pm-gpt`  

生产需配置 Upstash/`KV_REST_API_*`，否则 serverless 登记会丢。

## Custom GPT 清单

- [ ] Instructions = `INSTRUCTIONS.md`  
- [ ] Knowledge：至少 `knowledge/CANONICAL_RULES.md`；可选 `star-pm-write-release` 全文  
- [ ] Connector 已授权且 `list_projects` 成功  
- [ ] 试一次 `capture_idea`（`rawThought` = 用户原句）并在 PM UI 核对  

## 与 Cursor 插件的关系

| | Cursor Plugin | ChatGPT |
|--|---------------|---------|
| Skills | 安装后自动发现 `skills/` | 蒸馏进 Instructions + Knowledge |
| Tools | `mcp.json` + Bearer 变量 | OAuth MCP Connector |
| 规则同源 | 是（本包 skill / CANONICAL_RULES） | 是 |

密钥**不要**写进 GPT 公开配置或 Git。
