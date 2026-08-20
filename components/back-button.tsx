"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type NavRouter = { back: () => void; push: (href: string) => void };
const IN_APP_NAV_KEY = "star-pm:has-in-app-nav";

/** 路径层级上的父页（无站内上一步时的兜底） */
export function backFallback(pathname: string): string | null {
  if (pathname === "/") return null;

  const projectMatch = pathname.match(/^\/projects\/([^/]+)(\/.*)?$/);
  if (projectMatch) {
    const sub = projectMatch[2] ?? "";
    if (sub.startsWith("/bugs/") && sub !== "/bugs") {
      return `/projects/${projectMatch[1]}/bugs`;
    }
    if (sub.startsWith("/requirements/")) {
      return `/projects/${projectMatch[1]}/tasks`;
    }
    if (sub && sub !== "") {
      return `/projects/${projectMatch[1]}`;
    }
    return "/projects";
  }

  if (pathname.startsWith("/boards/")) return "/";
  if (pathname.startsWith("/share/")) return "/boards/requirements";

  return "/";
}

function sameOriginReferrer(): boolean {
  if (typeof window === "undefined") return false;
  const ref = document.referrer;
  if (!ref) return false;
  try {
    return new URL(ref).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function markInAppNavigation() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(IN_APP_NAV_KEY, "1");
  } catch {
    /* private mode */
  }
}

function hasInAppNavigation(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(IN_APP_NAV_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return sameOriginReferrer();
}

/**
 * 默认回浏览器上一步；本标签页没有站内来源时再 push fallback。
 */
export function navigateBack(
  router: NavRouter,
  fallback: string | null | undefined
) {
  if (typeof window !== "undefined" && hasInAppNavigation()) {
    router.back();
    return;
  }
  if (fallback) {
    router.push(fallback);
    return;
  }
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  router.push("/");
}

/** 挂在壳上：客户端换页后标记「有上一步」 */
export function InAppNavTracker() {
  const pathname = usePathname();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (prev.current !== null && prev.current !== pathname) {
      markInAppNavigation();
    }
    prev.current = pathname;
  }, [pathname]);
  return null;
}

type HistoryBackProps = {
  /** 无站内上一步时的兜底；默认按当前路径推算 */
  fallback?: string | null;
  label?: string;
  className?: string;
};

/** 顶栏/页内通用「← 返回」：优先上一步 */
export function BackButton({
  fallback,
  label = "← 返回",
  className = "rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50",
}: HistoryBackProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const href = fallback === undefined ? backFallback(pathname) : fallback;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 首页且无兜底时：等挂载后再根据是否有上一步决定显示，避免 SSR 不一致
  if (href === null) {
    if (!mounted || !hasInAppNavigation()) return null;
  }

  return (
    <button
      type="button"
      onClick={() => navigateBack(router, href ?? "/")}
      className={className}
    >
      {label}
    </button>
  );
}

/** 页内文字链样式的返回（替代固定 &lt;a href&gt;） */
export function BackLink({
  fallback,
  label = "← 返回",
  className = "text-sm text-indigo-600 hover:underline",
}: HistoryBackProps) {
  const pathname = usePathname();
  const router = useRouter();
  const href = fallback === undefined ? backFallback(pathname) : fallback;

  return (
    <button
      type="button"
      onClick={() => navigateBack(router, href ?? "/")}
      className={className}
    >
      {label}
    </button>
  );
}
