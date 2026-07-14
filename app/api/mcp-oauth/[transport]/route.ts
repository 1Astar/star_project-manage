import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { getMcpRedisUrl } from "@/lib/mcp/config";
import { registerStarPmTools } from "@/lib/mcp/server";
import { verifyOAuthAccessToken } from "@/lib/mcp/oauth/verify-oauth-token";

export const maxDuration = 60;
export const runtime = "nodejs";

const handler = createMcpHandler(
  (server) => {
    registerStarPmTools(server);
  },
  {
    serverInfo: {
      name: "star-pm-gpt",
      version: "1.3.2",
    },
  },
  {
    basePath: "/api/mcp-oauth",
    maxDuration: 60,
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
const authHandler = withMcpAuth(handler, verifyOAuthAccessToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp-oauth/mcp",
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
