import { Redis } from "@upstash/redis";
import { createHash, randomBytes } from "node:crypto";
import { getMcpSecret } from "@/lib/mcp/auth";
import { fetchCimdClient } from "@/lib/mcp/oauth/cimd";
import {
  isSignedOAuthToken,
  mintSignedAuthCode,
  mintSignedAccessToken,
  mintSignedRefreshToken,
  verifySignedAccessToken,
  verifySignedAuthCode,
  verifySignedRefreshToken,
} from "@/lib/mcp/oauth/signed";

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
  try {
    const url = process.env.KV_REST_API_URL?.trim() || process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token =
      process.env.KV_REST_API_TOKEN?.trim() || process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (!url || !token) return null;
    return new Redis({ url, token });
  } catch {
    return null;
  }
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
  try {
    const r = redis();
    if (r) {
      // ChatGPT caches client_id indefinitely; keep DCR clients ≥1y
      await r.set(key(["client", client.client_id]), client, { ex: 60 * 60 * 24 * 400 });
      return;
    }
  } catch {
    /* Workers 无 KV / Redis 失败时退回内存 */
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

async function loadStoredClient(clientId: string): Promise<OAuthClient | null> {
  if (clientId === staticGptClient().client_id) {
    return staticGptClient();
  }
  try {
    const r = redis();
    if (r) {
      return (await r.get<OAuthClient>(key(["client", clientId]))) ?? null;
    }
  } catch {
    /* ignore */
  }
  return memory.clients.get(clientId) ?? null;
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  try {
    const stored = await loadStoredClient(clientId);
    if (stored) return stored;
    if (!clientId.startsWith("https://")) return null;
    const cimd = await fetchCimdClient(clientId);
    if (!cimd) return null;
    await saveClient(cimd);
    return cimd;
  } catch {
    return null;
  }
}

/**
 * ChatGPT 会缓存 DCR 的 client_id，且常跳过重新 register。
 * Redis 过期 / 无 KV 冷启动丢失后，用 gpt_/cursor_ 前缀 + 合法 redirect 自动恢复登记。
 * https:// client_id → CIMD 拉取。
 */
export async function ensureDcrClient(
  clientId: string,
  redirectUri: string,
): Promise<OAuthClient | null> {
  if (!isAllowedRedirect(redirectUri)) return null;

  if (clientId.startsWith("https://")) {
    const client = await getClient(clientId);
    if (!client) return null;
    return clientAcceptsRedirect(client, redirectUri) ? client : null;
  }

  const existing = await loadStoredClient(clientId);
  if (existing) {
    if (
      existing.client_id !== staticGptClient().client_id &&
      !existing.redirect_uris.includes(redirectUri)
    ) {
      existing.redirect_uris = [...existing.redirect_uris, redirectUri];
      await saveClient(existing);
    }
    return existing;
  }
  if (!clientId.startsWith("gpt_") && !clientId.startsWith("cursor_")) return null;
  const client: OAuthClient = {
    client_id: clientId,
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: "none",
    client_name: "Recovered MCP client",
    grant_types: ["authorization_code"],
    response_types: ["code"],
    scope: "star-pm:read star-pm:write offline_access",
  };
  await saveClient(client);
  return client;
}

export function clientAcceptsRedirect(client: OAuthClient, redirectUri: string) {
  if (!isAllowedRedirect(redirectUri)) return false;
  if (client.client_id === staticGptClient().client_id) return true;
  return client.redirect_uris.includes(redirectUri);
}

/** 签发自包含授权码（Workers 跨实例可用；有 Redis 时另存一份防重放）。 */
export async function issueAuthCode(input: {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
}): Promise<string> {
  const code = mintSignedAuthCode(input);
  const record: AuthCode = {
    code,
    client_id: input.client_id,
    redirect_uri: input.redirect_uri,
    code_challenge: input.code_challenge,
    code_challenge_method: input.code_challenge_method,
    scope: input.scope,
    expires_at: Date.now() + 5 * 60 * 1000,
  };
  try {
    const r = redis();
    if (r) {
      await r.set(key(["code", code]), record, { ex: 5 * 60 });
      return code;
    }
  } catch {
    /* ignore Redis */
  }
  memory.codes.set(code, record);
  return code;
}

export async function takeAuthCode(code: string): Promise<AuthCode | null> {
  let signed: ReturnType<typeof verifySignedAuthCode> = null;
  try {
    signed = verifySignedAuthCode(code);
  } catch {
    signed = null;
  }
  if (signed) {
    try {
      const r = redis();
      if (r) {
        const k = key(["code", code]);
        const stored = await r.get<AuthCode>(k);
        if (stored) await r.del(k);
        const usedKey = key(["code-used", signed.jti]);
        const used = await r.get<string>(usedKey);
        if (used) return null;
        await r.set(usedKey, "1", { ex: 10 * 60 });
      } else if (memory.codes.has(code)) {
        memory.codes.delete(code);
      }
    } catch {
      /* Redis 失败仍接受签名码 */
    }
    return {
      code,
      client_id: signed.client_id,
      redirect_uri: signed.redirect_uri,
      code_challenge: signed.code_challenge,
      code_challenge_method: signed.code_challenge_method,
      scope: signed.scope,
      expires_at: signed.exp,
    };
  }

  try {
    const r = redis();
    if (r) {
      const k = key(["code", code]);
      const data = await r.get<AuthCode>(k);
      if (data) await r.del(k);
      return data;
    }
  } catch {
    /* ignore */
  }
  const data = memory.codes.get(code) ?? null;
  if (data) memory.codes.delete(code);
  return data;
}

/** 签发 access + refresh（签名态，不依赖 Redis）。 */
export async function issueTokenPair(input: { client_id: string; scope: string }) {
  const access = mintSignedAccessToken(input);
  const refresh = mintSignedRefreshToken(input);
  try {
    const r = redis();
    if (r) {
      await r.set(
        key(["token", access.token]),
        {
          token: access.token,
          client_id: input.client_id,
          scope: input.scope,
          expires_at: Date.now() + access.expires_in * 1000,
        } satisfies AccessTokenRecord,
        { ex: access.expires_in }
      );
    }
  } catch {
    /* ignore */
  }
  return {
    access_token: access.token,
    refresh_token: refresh.token,
    token_type: "bearer" as const,
    expires_in: access.expires_in,
    scope: input.scope,
  };
}

export async function refreshAccessToken(refreshToken: string, clientId: string) {
  const signed = verifySignedRefreshToken(refreshToken);
  if (!signed || signed.client_id !== clientId) return null;
  return issueTokenPair({ client_id: signed.client_id, scope: signed.scope });
}

export async function getAccessToken(token: string): Promise<AccessTokenRecord | null> {
  if (isSignedOAuthToken(token)) {
    const signed = verifySignedAccessToken(token);
    if (!signed) return null;
    return {
      token,
      client_id: signed.client_id,
      scope: signed.scope,
      expires_at: signed.exp,
    };
  }
  const r = redis();
  if (r) {
    return (await r.get<AccessTokenRecord>(key(["token", token]))) ?? null;
  }
  return memory.tokens.get(token) ?? null;
}

/** @deprecated 保留给旧路径；新路径用 issueAuthCode */
export async function saveAuthCode(code: AuthCode) {
  const ttl = Math.max(30, Math.floor((code.expires_at - Date.now()) / 1000));
  const r = redis();
  if (r) {
    await r.set(key(["code", code.code]), code, { ex: ttl });
    return;
  }
  memory.codes.set(code.code, code);
}

/** @deprecated 保留给旧路径；新路径用 issueTokenPair */
export async function saveAccessToken(record: AccessTokenRecord) {
  const ttl = Math.max(60, Math.floor((record.expires_at - Date.now()) / 1000));
  const r = redis();
  if (r) {
    await r.set(key(["token", record.token]), record, { ex: ttl });
    return;
  }
  memory.tokens.set(record.token, record);
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
