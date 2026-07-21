/** Edge-safe auth helpers（middleware 可用，勿 import next/headers） */

export type AuthRole = "admin" | "viewer";

export type AuthSessionPeek = {
  email: string;
  role: AuthRole;
};

export const SESSION_COOKIE_NAME = "star-pm-session";

function decodeBase64UrlJson(payload: string): Record<string, unknown> | null {
  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(payload, "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 只解析 payload，不验签（与历史 middleware 信任模型一致） */
export function peekSessionPayload(token: string): AuthSessionPeek | null {
  const [payload] = token.split(".");
  if (!payload) return null;
  const data = decodeBase64UrlJson(payload);
  if (!data || typeof data.email !== "string" || !data.email) return null;
  if (typeof data.exp === "number" && data.exp < Date.now()) return null;
  const role: AuthRole = data.role === "viewer" ? "viewer" : "admin";
  return { email: data.email, role };
}

export function isKeysSensitivePath(pathname: string): boolean {
  if (pathname === "/keys" || pathname.startsWith("/keys/")) return true;
  if (/^\/projects\/[^/]+\/secrets(\/|$)/.test(pathname)) return true;
  if (pathname.startsWith("/api/studio/projects/") && pathname.includes("/secrets")) {
    return true;
  }
  return false;
}
