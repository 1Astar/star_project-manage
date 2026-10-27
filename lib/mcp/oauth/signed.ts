import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getMcpSecret } from "@/lib/mcp/auth";

/** Workers 无共享内存时，用 HMAC 自包含 code/token，不依赖 Redis。 */
const PREFIX = "spm1";

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function nonce(bytes = 12) {
  return bytesToB64url(new Uint8Array(randomBytes(bytes)));
}

type CodePayload = {
  v: 1;
  typ: "code";
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  exp: number;
  jti: string;
};

type AccessPayload = {
  v: 1;
  typ: "at";
  client_id: string;
  scope: string;
  exp: number;
  jti: string;
};

type RefreshPayload = {
  v: 1;
  typ: "rt";
  client_id: string;
  scope: string;
  exp: number;
  jti: string;
};

function signingKey() {
  return getMcpSecret();
}

function b64urlJson(obj: unknown) {
  return bytesToB64url(new TextEncoder().encode(JSON.stringify(obj)));
}

function sign(body: string) {
  const digest = createHmac("sha256", signingKey()).update(body).digest();
  return bytesToB64url(digest instanceof Uint8Array ? digest : new Uint8Array(digest));
}

function seal(payload: CodePayload | AccessPayload | RefreshPayload) {
  const body = b64urlJson(payload);
  return `${PREFIX}.${body}.${sign(body)}`;
}

function timingSafeStr(a: string, b: string) {
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function open<T extends { typ: string; exp: number }>(
  token: string,
  typ: T["typ"]
): T | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const [, body, mac] = parts;
  if (!body || !mac) return null;
  const expected = sign(body);
  try {
    if (!timingSafeStr(mac, expected)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as T;
    if (payload.typ !== typ) return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isSignedOAuthToken(token: string) {
  return token.startsWith(`${PREFIX}.`);
}

export function mintSignedAuthCode(input: {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string;
  ttlMs?: number;
}) {
  return seal({
    v: 1,
    typ: "code",
    client_id: input.client_id,
    redirect_uri: input.redirect_uri,
    code_challenge: input.code_challenge,
    code_challenge_method: input.code_challenge_method,
    scope: input.scope,
    exp: Date.now() + (input.ttlMs ?? 5 * 60 * 1000),
    jti: nonce(12),
  });
}

export function verifySignedAuthCode(code: string): CodePayload | null {
  return open<CodePayload>(code, "code");
}

export function mintSignedAccessToken(input: {
  client_id: string;
  scope: string;
  ttlSec?: number;
}) {
  const ttlSec = input.ttlSec ?? 60 * 60 * 12;
  const token = seal({
    v: 1,
    typ: "at",
    client_id: input.client_id,
    scope: input.scope,
    exp: Date.now() + ttlSec * 1000,
    jti: nonce(12),
  });
  return { token, expires_in: ttlSec };
}

export function verifySignedAccessToken(token: string): AccessPayload | null {
  return open<AccessPayload>(token, "at");
}

export function mintSignedRefreshToken(input: {
  client_id: string;
  scope: string;
  ttlSec?: number;
}) {
  const ttlSec = input.ttlSec ?? 60 * 60 * 24 * 30;
  const token = seal({
    v: 1,
    typ: "rt",
    client_id: input.client_id,
    scope: input.scope,
    exp: Date.now() + ttlSec * 1000,
    jti: nonce(12),
  });
  return { token, expires_in: ttlSec };
}

export function verifySignedRefreshToken(token: string): RefreshPayload | null {
  return open<RefreshPayload>(token, "rt");
}
