"use client";

import { usePathname, useRouter } from "next/navigation";

function backTarget(pathname: string): string | null {
  if (pathname === "/") return null;

  const projectMatch = pathname.match(/^\/projects\/([^/]+)(\/.*)?$/);
  if (projectMatch) {
    const sub = projectMatch[2];
    if (sub && sub !== "") {
      return `/projects/${projectMatch[1]}`;
    }
    return "/projects";
  }

  return "/";
}

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const href = backTarget(pathname);

  if (!href) return null;

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
    >
      ← 返回
    </button>
  );
}
