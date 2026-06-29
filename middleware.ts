import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/share",
  "/ui-preview",
  "/api/cron",
  "/api/health",
  "/_next",
  "/favicon",
  "/prototypes",
];

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const withPathname = () =>
    NextResponse.next({
      request: { headers: requestHeaders },
    });

  if (process.env.REQUIRE_AUTH === "false") {
    return withPathname();
  }

  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return withPathname();
  }

  const token = request.cookies.get("star-pm-session")?.value;
  if (token && token.includes(".")) {
    return withPathname();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
