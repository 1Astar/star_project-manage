import { Redis } from "@upstash/redis";
import { createHash, randomBytes } from "node:crypto";
import { getMcpSecret } from "@/lib/mcp/auth";

export type OAuthClient = {
  client_id: string;
  client_secret?: string;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  client_name?: string;
  grant_types: string[];
  response_types: string[];
  scope?: string;
};

export type AuthCode = {
  code: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  expires_at: number;
};

export type AccessTokenRecord = {
  token: string;
  client_id: string;
  scope: string;
  expires_at: number;
};

const memory = {
  clients: new Map<string, OAuthClient>(),
  codes: new Map<string, AuthCode>(),
  tokens: new Map<string, AccessTokenRecord>(),
};

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL?.trim() || process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token =
    process.env.KV_REST_API_TOKEN?.trim() || process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function key(parts: string[]) {
  return ["star-pm-oauth", ...parts].join(":");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function verifyPkce(codeVerifier: string, challenge: string, method: string) {
  if (method !== "S256") return false;
  const hash = createHash("sha256").update(codeVerifier).digest("base64url");
  return hash === challenge;
}

export function publicOrigin(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
  return new URL(request.url).origin;
}

export function mcpOAuthResourceUrl(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/mcp-oauth/mcp`;
}

export async function saveClient(client: OAuthClient) {
  const r = redis();
  if (r) {
    await r.set(key(["client", client.client_id]), client, { ex: 60 * 60 * 24 * 90 });
    return;
  }
  memory.clients.set(client.client_id, client);
}

/** Fixed public client for ChatGPT「用户自定义 OAuth 客户端」手动填写。 */
export function staticGptClient(): OAuthClient {
  return {
    client_id: process.env.STAR_PM_OAUTH_CLIENT_ID?.trim() || "star-pm-gpt",
    token_endpoint_auth_method: "none",
    redirect_uris: [], // validated via isAllowedRedirect at runtime
    client_name: "Star PM ChatGPT",
    grant_types: ["authorization_code"],
    response_types: ["code"],
    scope: "star-pm:read star-pm:write",
  };
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  if (clientId === staticGptClient().client_id) {
    return staticGptClient();
  }
  const r = redis();
  if (r) {
    return (await r.get<OAuthClient>(key(["client", clientId]))) ?? null;
  }
  return memory.clients.get(clientId) ?? null;
}

export function clientAcceptsRedirect(client: OAuthClient, redirectUri: string) {
  if (!isAllowedRedirect(redirectUri)) return false;
  if (client.client_id === staticGptClient().client_id) return true;
  return client.redirect_uris.includes(redirectUri);
}

export async function saveAuthCode(code: AuthCode) {
  const ttl = Math.max(30, Math.floor((code.expires_at - Date.now()) / 1000));
  const r = redis();
  if (r) {
    await r.set(key(["code", code.code]), code, { ex: ttl });
    return;
  }
  memory.codes.set(code.code, code);
}

export async function takeAuthCode(code: string): Promise<AuthCode | null> {
  const r = redis();
  if (r) {
    const k = key(["code", code]);
    const data = await r.get<AuthCode>(k);
    if (data) await r.del(k);
    return data;
  }
  const data = memory.codes.get(code) ?? null;
  if (data) memory.codes.delete(code);
  return data;
}

export async function saveAccessToken(record: AccessTokenRecord) {
  const ttl = Math.max(60, Math.floor((record.expires_at - Date.now()) / 1000));
  const r = redis();
  if (r) {
    await r.set(key(["token", record.token]), record, { ex: ttl });
    return;
  }
  memory.tokens.set(record.token, record);
}

export async function getAccessToken(token: string): Promise<AccessTokenRecord | null> {
  const r = redis();
  if (r) {
    return (await r.get<AccessTokenRecord>(key(["token", token]))) ?? null;
  }
  return memory.tokens.get(token) ?? null;
}

export function assertOwnerSecret(secret: string | null | undefined): boolean {
  if (!secret) return false;
  return secret.trim() === getMcpSecret();
}

export function isAllowedRedirect(uri: string) {
  try {
    const u = new URL(uri);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && u.hostname === "localhost")) {
      return false;
    }
    // ChatGPT connector + Cursor + local tools
    if (
      u.hostname === "chatgpt.com" ||
      u.hostname.endsWith(".chatgpt.com") ||
      u.hostname === "chat.openai.com" ||
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "cursor.com" ||
      u.hostname.endsWith(".cursor.com")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
