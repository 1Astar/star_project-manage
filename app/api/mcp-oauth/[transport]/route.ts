import { createWebStreamableMcpHandler } from "@/lib/mcp/web-streamable-handler";
import { runWithMcpAdminScope } from "@/lib/auth/request-scope";
import { MCP_OAUTH_SERVER_NAME, MCP_SERVER_VERSION } from "@/lib/mcp/version";
import { verifyOAuthAccessToken } from "@/lib/mcp/oauth/verify-oauth-token";
import { withMcpAuth } from "mcp-handler";

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * ChatGPT OAuth MCP。
 * 传输层用 Web Standard；鉴权仍用 withMcpAuth（RFC 9728 discovery）。
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

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
