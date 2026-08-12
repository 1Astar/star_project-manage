# 动态 MCP 工具目录

由元工具 `add_mcp_tool` 生成：`registry.json` + `<name>/tool.json` + `<name>/handler.ts`。

- 启用的工具在 **MCP 启动** 时加载（`registerDynamicMcpTools`）。
- **不热挂**：加完后需重启/重连 MCP。
- 延期项（热挂 / 沙箱 JS / 改 workspace-tools）见 `lib/mcp/dynamic-tools.ts` 内 `DYNAMIC_MCP_DEFER_SCOPE`。
