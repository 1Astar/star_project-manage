import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isKeysSensitivePath,
  peekSessionPayload,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session-edge";

const PUBLIC_PREFIXES = [
  "/login",
  "/share",
  "/ui-preview",
  "/api/cron",
  "/api/ideas",
  "/api/github/sync-ideas",
  "/api/mcp",
  "/api/mcp-oauth",
  "/api/sse",
  "/api/message",
  "/oauth",
  "/.well-known",
  "/_next",
  "/favicon",
  "/icon",
  "/apple-icon",
  "/prototypes",
];

export function middleware(request: NextRequest) {
  if (process.env.REQUIRE_AUTH === "false") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token || !token.includes(".")) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isKeysSensitivePath(pathname)) {
    const session = peekSessionPayload(token);
    if (!session || session.role !== "admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "观看者无权访问密钥区" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/?error=keys-forbidden", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
