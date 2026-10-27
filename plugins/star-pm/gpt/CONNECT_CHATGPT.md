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

v1.20.3+：授权码 / access token 为 **HMAC 签名态**，Workers **不依赖** Upstash 也能完成换 token。  
仍建议配置 `KV_REST_API_*`（防重放、DCR 持久），但不再是连上的硬前置。

### 「部分应用设置未通过验证」（图标 / 身份验证）

ChatGPT 创建插件前会校验：站点图标、OAuth 发现元数据（CIMD / `offline_access` / `iss` 等）。

处理：确认线上 **≥ v1.20.4**，然后：

1. 描述可填：`Star PM 灵感与项目管理`  
2. URL：`https://pm.starry-studio.cn/api/mcp-oauth/mcp`  
3. 身份验证选 **OAuth**（或「OAuth 或无需身份验证」）  
4. 可展开「高级 OAuth 设置」看自动发现是否成功；仍失败则手动 `client_id` = `star-pm-gpt`  
5. 勾选风险确认 → 创建 → 授权页填 **`STAR_PM_MCP_SECRET`**

### 「MCP 服务器拒绝了访问」

未带 token 探测时应返回 **401 + `WWW-Authenticate`**。缺 CORS 或换 token 失败也会报这句。需 **≥ v1.20.3**。

### 「We couldn't connect your account」

这是 **ChatGPT 侧**的 OAuth 连接失败文案（不是 Star PM 账号密码登录）。与 Cursor Bearer **无关**。

常见原因（按概率）：

1. **授权页未填对密钥**：必须输入生产 **`STAR_PM_MCP_SECRET`** 再点「批准授权」  
2. **URL 填错**：不要用 Cursor 的 `/api/mcp`（Bearer）  
3. **旧连接缓存**：删除连接器 → 重新添加 → 完整走完授权  
4. **备选**：高级 OAuth 里手动 `client_id` = `star-pm-gpt`  

Cursor 侧只要 `~/.cursor/mcp.json` Bearer 正确，**不受**此报错影响。

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
