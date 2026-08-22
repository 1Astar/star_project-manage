# MCP 动态自增工具 · 延期范围（与 `DYNAMIC_MCP_DEFER_SCOPE` 同步）

**本期已做（B）**：`add_mcp_tool` / `list_dynamic_mcp_tools` / `disable_mcp_tool`；落盘 `lib/mcp/dynamic-tools/`；启动加载。

同批延期三子项（平等，防双盲）：

---

## 子·运行时热挂 + list_changed

【是什么】add 成功后当场 registerTool + 通知客户端，无需重启。  
【为什么本期不做】Cursor 对 list_changed 支持不稳定；热挂风险高；先验证落盘。  
【前期已落地】registry + registerDynamicMcpTools。  
【后期怎么做】确认客户端支持 → 动态 import → registerTool → list_changed；验收：同会话 tools/list 出现新名且可调。  
【不做混淆项】不是改 Cursor 插件；不是热改内置工具。  
【触发重开】用户要「加完立刻能调」且接受白名单。  
【同批兄弟】沙箱 JS、改 workspace-tools。

---

## 子·沙箱执行任意 JS

【是什么】sketch 当脚本在 docker/node 沙箱跑。  
【为什么本期不做】任意代码=密钥与数据风险，需隔离审计。  
【前期已落地】只生成 handler 骨架，默认未实现错误。  
【后期怎么做】参考 dynamic-mcp；超时；禁读 env；审计。验收：恶意 fs/env 被拒。  
【不做混淆项】不是主进程 eval；不是放开爬虫。  
【触发重开】有沙箱方案且要「口头造工具即跑」。  
【同批兄弟】热挂、改 workspace-tools。

---

## 子·自动改写 workspace-tools.ts

【是什么】新工具 codegen 进主清单成一等公民。  
【为什么本期不做】大文件冲突/评审成本高；动态目录已解耦实验工具。  
【前期已落地】独立 `dynamic-tools/<name>/`。  
【后期怎么做】codegen 或 barrel；PR 模板；禁覆盖内置。验收：diff 可审、CI 过。  
【不做混淆项】人手仍可直接写内置工具。  
【触发重开】某动态工具稳定要「转正」。  
【同批兄弟】热挂、沙箱 JS。
