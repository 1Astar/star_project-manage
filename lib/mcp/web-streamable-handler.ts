import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { registerStarPmTools } from "@/lib/mcp/server";

type RegisterTools = (server: McpServer) => void | Promise<void>;

/**
 * Cloudflare / OpenNext 专用：纯 Web Standard Streamable HTTP。
 * 不用 mcp-handler（其 Node ServerResponse 适配器在 Workers 上会挂死 initialize）。
 *
 * - enableJsonResponse：避免 SSE 流在 Workers 上永不 flush
 * - sessionIdGenerator undefined：无状态，每请求新建 server+transport（Workers 无跨请求内存）
 */
export function createWebStreamableMcpHandler(options: {
  name: string;
  version: string;
  registerTools?: RegisterTools;
}) {
  const register = options.registerTools ?? registerStarPmTools;

  return async (req: Request): Promise<Response> => {
    if (req.method === "GET" || req.method === "DELETE") {
      return Response.json(
        {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed." },
          id: null,
        },
        { status: 405 }
      );
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const server = new McpServer({
      name: options.name,
      version: options.version,
    });
    await register(server);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);

    const auth = (req as Request & { auth?: AuthInfo }).auth;
    try {
      return await transport.handleRequest(req, { authInfo: auth });
    } finally {
      try {
        await transport.close();
      } catch {
        /* ignore */
      }
      try {
        await server.close();
      } catch {
        /* ignore */
      }
    }
  };
}
