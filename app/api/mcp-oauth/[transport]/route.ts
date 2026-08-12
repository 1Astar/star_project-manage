import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { runWithMcpAdminScope } from "@/lib/auth/request-scope";
import { getMcpRedisUrl } from "@/lib/mcp/config";
import { registerStarPmTools } from "@/lib/mcp/server";
import { MCP_OAUTH_SERVER_NAME, MCP_SERVER_VERSION } from "@/lib/mcp/version";
import { verifyOAuthAccessToken } from "@/lib/mcp/oauth/verify-oauth-token";

export const maxDuration = 60;
export const runtime = "nodejs";

const handler = createMcpHandler(
  async (server) => {
    await registerStarPmTools(server);
  },
  {
    serverInfo: {
      name: MCP_OAUTH_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
  },
  {
    basePath: "/api/mcp-oauth",
    maxDuration: 60,
    // SSE needs TCP Redis; CF Workers default to Streamable HTTP only (no REDIS_URL).
    redisUrl: getMcpRedisUrl(),
    disableSse: !getMcpRedisUrl(),
    verboseLogs: process.env.VERCEL_ENV === "preview",
  }
);

/**
 * Do NOT pass resourceUrl as the MCP resource path — withMcpAuth uses it as
 * origin when building WWW-Authenticate resource_metadata, which would produce:
 * /api/mcp-oauth/mcp/.well-known/... (broken).
 */
const scopedHandler = async (req: Request) =>
  runWithMcpAdminScope(() => handler(req));

const authHandler = withMcpAuth(scopedHandler, verifyOAuthAccessToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp-oauth/mcp",
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
