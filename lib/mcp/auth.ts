import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

export function getMcpSecret(): string {
  return (
    process.env.STAR_PM_MCP_SECRET?.trim() ||
    process.env.IDEAS_CAPTURE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "dev-cron-secret"
  );
}

export async function verifyMcpToken(
  request: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  const expected = getMcpSecret();
  const headerSecret = request.headers.get("x-star-pm-mcp-secret");
  const authHeader = request.headers.get("authorization");
  const bearer =
    bearerToken ??
    (authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader?.trim());

  const token = bearer || headerSecret;
  if (!token || token !== expected) return undefined;

  return {
    token,
    scopes: ["star-pm:read", "star-pm:write"],
    clientId: "star-pm-mcp",
  };
}
