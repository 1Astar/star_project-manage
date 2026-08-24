import { createWebStreamableMcpHandler } from "@/lib/mcp/web-streamable-handler";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "@/lib/mcp/version";
import { withBearerMcpAuth } from "@/lib/mcp/with-bearer-auth";

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Cursor / Codex Bearer MCP。
 * CF Workers 走 Web Standard 传输（见 web-streamable-handler），避免 mcp-handler 挂死。
 */
const handler = createWebStreamableMcpHandler({
  name: MCP_SERVER_NAME,
  version: MCP_SERVER_VERSION,
});

const authHandler = withBearerMcpAuth(handler);

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
