import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { registerStarPmTools } from "@/lib/mcp/server";

type RegisterTools = (server: McpServer) => void | Promise<void>;

/**
 * initialize / ping / notifications 不需要注册 60+ 工具；
 * 只有 tools/list、tools/call 等才全量 register（CF Worker CPU 硬限制）。
 */
export function mcpMethodsNeedTools(methods: string[]): boolean {
  return methods.some(
    (m) =>
      m === "tools/list" ||
      m === "tools/call" ||
      m.startsWith("tools/") ||
      m === "resources/list" ||
      m === "resources/read" ||
      m === "prompts/list" ||
      m === "prompts/get"
  );
}

export function extractJsonRpcMethods(body: unknown): string[] {
  const msgs = Array.isArray(body) ? body : [body];
  const out: string[] = [];
  for (const msg of msgs) {
    if (!msg || typeof msg !== "object") continue;
    const method = (msg as { method?: unknown }).method;
    if (typeof method === "string" && method.trim()) out.push(method.trim());
  }
  return out;
}

/**
 * Cloudflare / OpenNext 专用：纯 Web Standard Streamable HTTP。
 * 不用 mcp-handler（其 Node ServerResponse 适配器在 Workers 上会挂死 initialize）。
 *
 * - enableJsonResponse：避免 SSE 流在 Workers 上永不 flush
 * - sessionIdGenerator undefined：无状态，每请求新建 server+transport（Workers 无跨请求内存）
 * - 懒注册：initialize 等轻请求跳过全量工具注册，降低 CPU → 1102
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

    // 先读 body 判断 method，再重建 Request 交给 transport（body 只能读一次）
    const raw = await req.arrayBuffer();
    let methods: string[] = [];
    try {
      const text = new TextDecoder().decode(raw);
      if (text.trim()) {
        methods = extractJsonRpcMethods(JSON.parse(text) as unknown);
      }
    } catch {
      /* 解析失败则保守全量注册，让 SDK 返回标准 JSON-RPC 错 */
      methods = ["tools/list"];
    }
    const needTools = methods.length === 0 || mcpMethodsNeedTools(methods);

    const server = new McpServer({
      name: options.name,
      version: options.version,
    });
    if (needTools) {
      await register(server);
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);

    const auth = (req as Request & { auth?: AuthInfo }).auth;
    const replay = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: raw.byteLength ? raw : undefined,
    });
    try {
      return await transport.handleRequest(replay, { authInfo: auth });
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
