import { createMcpHandler } from "mcp-handler";
import { getMcpRedisUrl } from "@/lib/mcp/config";
import { registerStarPmTools } from "@/lib/mcp/server";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "@/lib/mcp/version";
import { withBearerMcpAuth } from "@/lib/mcp/with-bearer-auth";

export const maxDuration = 60;
export const runtime = "nodejs";

const handler = createMcpHandler(
  (server) => {
    registerStarPmTools(server);
  },
  {
    serverInfo: {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    redisUrl: getMcpRedisUrl(),
    disableSse: !getMcpRedisUrl(),
    verboseLogs: process.env.VERCEL_ENV === "preview",
  }
);

/** Bearer/API key only — do not use withMcpAuth (it forces OAuth discovery Cursor can't complete). */
const authHandler = withBearerMcpAuth(handler);

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
