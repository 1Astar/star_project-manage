import { createWebStreamableMcpHandler } from "@/lib/mcp/web-streamable-handler";
import { runWithMcpAdminScope } from "@/lib/auth/request-scope";
import { MCP_OAUTH_SERVER_NAME, MCP_SERVER_VERSION } from "@/lib/mcp/version";
import { verifyOAuthAccessToken } from "@/lib/mcp/oauth/verify-oauth-token";
import { withMcpAuth } from "mcp-handler";

export const maxDuration = 60;
export const runtime = "nodejs";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "WWW-Authenticate, mcp-session-id",
  "Access-Control-Max-Age": "86400",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

/**
 * ChatGPT OAuth MCP。
 * 传输层用 Web Standard；鉴权仍用 withMcpAuth（RFC 9728 discovery）。
 * 必须带 CORS：ChatGPT 浏览器侧探测 401 + WWW-Authenticate，否则会报「服务器拒绝了访问」。
 */
const rawHandler = createWebStreamableMcpHandler({
  name: MCP_OAUTH_SERVER_NAME,
  version: MCP_SERVER_VERSION,
});

const scopedHandler = async (req: Request) =>
  runWithMcpAdminScope(() => rawHandler(req));

const authHandler = withMcpAuth(scopedHandler, verifyOAuthAccessToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp-oauth/mcp",
});

async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  return withCors(await authHandler(req));
}

export { handler as GET, handler as POST, handler as DELETE, handler as OPTIONS };
