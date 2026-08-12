import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mcpError, mcpJson } from "@/lib/mcp/response";
import { logAiAction } from "@/lib/mcp/action-log";
import {
  addMcpToolToDisk,
  disableMcpToolOnDisk,
  DYNAMIC_MCP_DEFER_SCOPE,
  listDynamicMcpToolsFromDisk,
  type JsonSchemaLite,
} from "@/lib/mcp/dynamic-tools";

const jsonSchemaLite = z
  .object({
    type: z.string().optional(),
    properties: z
      .record(
        z.object({
          type: z.string().optional(),
          description: z.string().optional(),
          items: z.object({ type: z.string().optional() }).optional(),
        })
      )
      .optional(),
    required: z.array(z.string()).optional(),
  })
  .optional();

/** 套娃元工具：给 MCP 自己落盘新工具（重启后生效） */
export function registerDynamicMetaTools(server: McpServer) {
  server.registerTool(
    "add_mcp_tool",
    {
      title: "Add MCP Tool (scaffold)",
      description:
        "套娃：给 Star PM MCP 落盘一个新工具骨架（tool.json + handler.ts + registry）。本进程不热挂；重启/重连 MCP 后可用。禁止覆盖内置工具名。后期不做项见返回 deferred。",
      inputSchema: {
        name: z
          .string()
          .min(2)
          .describe("snake_case 工具名，如 summarize_module_bugs"),
        title: z.string().min(1).describe("短标题"),
        description: z.string().min(1).describe("给模型看的工具说明"),
        handlerSketch: z
          .string()
          .min(1)
          .describe("人话：调哪些现有 API、返回什么；写入 handler 注释"),
        inputSchema: jsonSchemaLite.describe(
          "简易 JSON Schema：properties/required；类型限 string|number|boolean|string[]"
        ),
        module: z
          .string()
          .optional()
          .describe("板块，默认 MCP·动态工具"),
        overwrite: z
          .boolean()
          .optional()
          .describe("已存在时覆盖骨架，默认 false"),
      },
    },
    async (input) => {
      try {
        const result = addMcpToolToDisk({
          name: input.name,
          title: input.title,
          description: input.description,
          handlerSketch: input.handlerSketch,
          inputSchema: input.inputSchema as JsonSchemaLite | undefined,
          module: input.module,
          overwrite: input.overwrite,
        });
        await logAiAction({
          action: "add_mcp_tool",
          payload: { name: result.meta.name, paths: result.paths },
        });
        return mcpJson({
          ok: true,
          ...result,
          deferred: DYNAMIC_MCP_DEFER_SCOPE.deferred,
          shipped: DYNAMIC_MCP_DEFER_SCOPE.shipped,
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "add_mcp_tool 失败"
        );
      }
    }
  );

  server.registerTool(
    "list_dynamic_mcp_tools",
    {
      title: "List Dynamic MCP Tools",
      description: "列出落盘的动态 MCP 工具（含 enabled / 板块）。",
      inputSchema: {},
    },
    async () => {
      try {
        const tools = listDynamicMcpToolsFromDisk();
        return mcpJson({
          ok: true,
          count: tools.length,
          tools,
          shipped: DYNAMIC_MCP_DEFER_SCOPE.shipped,
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "list_dynamic_mcp_tools 失败"
        );
      }
    }
  );

  server.registerTool(
    "disable_mcp_tool",
    {
      title: "Enable/Disable Dynamic MCP Tool",
      description:
        "启用或禁用已落盘的动态工具（写 registry）。下次启动才生效；enabled:false 为禁用。",
      inputSchema: {
        name: z.string().min(1),
        enabled: z
          .boolean()
          .optional()
          .describe("默认 false=禁用；传 true 重新启用"),
      },
    },
    async (input) => {
      try {
        const meta = disableMcpToolOnDisk(
          input.name,
          input.enabled === true
        );
        await logAiAction({
          action: "disable_mcp_tool",
          payload: { name: meta.name, enabled: meta.enabled },
        });
        return mcpJson({
          ok: true,
          meta,
          nextStep: "重启/重连 MCP 后加载集合才会变。",
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "disable_mcp_tool 失败"
        );
      }
    }
  );
}
