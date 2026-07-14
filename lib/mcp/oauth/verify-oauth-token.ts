import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { getAccessToken } from "@/lib/mcp/oauth/store";

export async function verifyOAuthAccessToken(
  _request: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  const record = await getAccessToken(bearerToken);
  if (!record) return undefined;
  if (record.expires_at < Date.now()) return undefined;

  return {
    token: bearerToken,
    clientId: record.client_id,
    scopes: record.scope.split(/\s+/).filter(Boolean),
  };
}
