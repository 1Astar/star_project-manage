import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { verifyMcpToken } from "@/lib/mcp/auth";

type McpHandler = (req: Request) => Response | Promise<Response>;

/**
 * Bearer / custom-header auth without RFC 9728 OAuth discovery.
 * Cursor treats WWW-Authenticate resource_metadata as "must do OAuth"
 * and then ignores mcp.json headers — so we must not advertise OAuth.
 */
export function withBearerMcpAuth(handler: McpHandler): McpHandler {
  return async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Authorization, Content-Type, Accept, mcp-session-id, x-star-pm-mcp-secret",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const authInfo = await verifyMcpToken(req);
    if (!authInfo) {
      return new Response(JSON.stringify({ error: "未授权：请在 mcp.json headers 配置 Authorization Bearer" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          // Intentionally plain Bearer — no resource_metadata / OAuth discovery
          "WWW-Authenticate": 'Bearer realm="star-pm-mcp"',
        },
      });
    }

    (req as Request & { auth?: AuthInfo }).auth = authInfo;
    return handler(req);
  };
}
