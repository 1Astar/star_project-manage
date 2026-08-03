import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import {
  SESSION_COOKIE_NAME,
  type AuthRole,
  type AuthSessionPeek,
} from "@/lib/auth/session-edge";

export type { AuthRole };
export type AuthSession = AuthSessionPeek;

export {
  isKeysSensitivePath,
  peekSessionPayload,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session-edge";

const MAX_AGE = 60 * 60 * 24 * 7;

function getSecret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? "dev-secret-change-in-production";
}

function signPayload(payloadObj: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySignedToken(token: string): Record<string, unknown> | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function signSession(email: string, role: AuthRole): string {
  return signPayload({ email, role, exp: Date.now() + MAX_AGE * 1000 });
}

export function verifySession(token: string): AuthSession | null {
  const data = verifySignedToken(token);
  if (!data) return null;
  if (typeof data.exp === "number" && data.exp < Date.now()) return null;
  if (typeof data.email !== "string" || !data.email) return null;
  const role: AuthRole = data.role === "viewer" ? "viewer" : "admin";
  return { email: data.email, role };
}

export async function getAdminSession(): Promise<AuthSession | null> {
  const { getMcpAdminSession } = await import("@/lib/auth/request-scope");
  const mcp = getMcpAdminSession();
  if (mcp) return mcp;

  // Always prefer a real signed cookie when present
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const session = verifySession(token);
      if (session) return session;
    }
  } catch {
    /* cookies() unavailable outside request (scripts) */
  }

  // Local open mode only: no cookie → treat as admin for DX.
  // Hosted (Vercel/EdgeOne/CF) never auto-admin — guests see demo sandbox only.
  if (!isAuthRequired() && allowOpenAdminWithoutLogin()) {
    return { email: "dev", role: "admin" };
  }
  return null;
}

/** Hosted platforms: never invent an admin session for anonymous browsers. */
export function allowOpenAdminWithoutLogin(): boolean {
  if (process.env.VERCEL === "1") return false;
  if (process.env.NEXT_PUBLIC_EDGEONE === "1" || process.env.EDGEONE === "1") {
    return false;
  }
  if (process.env.CF_PAGES === "1") return false;
  if (process.env.NEXT_PUBLIC_CF_WORKER === "1") return false;
  return true;
}

export async function setAdminSession(email: string, role: AuthRole = "admin"): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, signSession(email, role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
}

export function getAdminAccount(): string {
  return process.env.ADMIN_USERNAME ?? process.env.ADMIN_EMAIL ?? "admin";
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "1567@";
}

export function validateAdminCredentials(account: string, password: string): boolean {
  return account === getAdminAccount() && password === getAdminPassword();
}

export function validateViewerCredentials(account: string, password: string): boolean {
  const viewerAccount = process.env.VIEWER_USERNAME?.trim();
  const viewerPassword = process.env.VIEWER_PASSWORD ?? "";
  if (!viewerAccount || !viewerPassword) return false;
  return account === viewerAccount && password === viewerPassword;
}

/** 匹配 admin 或 viewer；admin 优先 */
export function resolveLoginRole(account: string, password: string): AuthRole | null {
  if (validateAdminCredentials(account, password)) return "admin";
  if (validateViewerCredentials(account, password)) return "viewer";
  return null;
}

export function isAuthRequired(): boolean {
  return process.env.REQUIRE_AUTH !== "false";
}
