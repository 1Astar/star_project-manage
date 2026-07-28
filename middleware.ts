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
  const hasSession = Boolean(token && token.includes("."));
  const session = hasSession && token ? peekSessionPayload(token) : null;
  const isAdmin = session?.role === "admin";

  // 密钥 / 项目密钥：必须管理员
  if (isKeysSensitivePath(pathname)) {
    if (!isAdmin) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "需管理员登录后访问密钥区" }, { status: 403 });
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 未登录：页面可逛（演示沙盘）；写 API 拦在中间件 + 服务端 assert
  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      if (request.method === "GET" || request.method === "HEAD") {
        return NextResponse.next();
      }
      return NextResponse.json(
        { error: "公开演示为只读，请管理员登录后操作" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
