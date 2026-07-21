"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { AppBrandFooter } from "@/components/app-brand-footer";
import { LogoutButton } from "@/components/logout-button";
import { appVersionLabel } from "@/lib/app-meta";
import type { AuthRole } from "@/lib/auth/session-edge";
import { PrefsHydrator } from "@/components/prefs-hydrator";
import { cn } from "@/lib/utils";

export const WORKBENCH_NAV = [
  { href: "/", label: "今日工作台", icon: "◉", adminOnly: false },
  { href: "/projects", label: "项目库", icon: "▣", adminOnly: false },
  { href: "/boards/requirements", label: "需求总览", icon: "▥", adminOnly: false },
  { href: "/stream", label: "灵感流", icon: "✦", adminOnly: false },
  { href: "/todos", label: "我的待办", icon: "☑", adminOnly: false },
  { href: "/evolution", label: "演进记录", icon: "↻", adminOnly: false },
  { href: "/assets", label: "资料 / 链接", icon: "🔗", adminOnly: false },
  { href: "/keys", label: "密钥索引", icon: "🔑", adminOnly: true },
  { href: "/settings", label: "设置", icon: "⚙", adminOnly: false },
] as const;

function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkbenchShell({
  title,
  subtitle,
  children,
  actions,
  nav,
  role: roleProp,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  nav?: React.ReactNode;
  /** 服务端传入时可跳过 /api/auth/me */
  role?: AuthRole;
}) {
  const pathname = usePathname();
  const [role, setRole] = useState<AuthRole | null>(roleProp ?? null);

  useEffect(() => {
    if (roleProp) {
      setRole(roleProp);
      return;
    }
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { role?: AuthRole };
        if (!cancelled && (json.role === "admin" || json.role === "viewer")) {
          setRole(json.role);
        }
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [roleProp]);

  const effectiveRole = role ?? "admin";
  const navItems = WORKBENCH_NAV.filter(
    (item) => !item.adminOnly || effectiveRole === "admin"
  );

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <PrefsHydrator />
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 px-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Star PM
            </div>
            <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {appVersionLabel()}
            </span>
            {effectiveRole === "viewer" ? (
              <span className="rounded-lg bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200">
                观看者
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-sm font-bold text-slate-800">个人项目操作台</div>
        </div>
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2 py-2 text-sm transition",
                isNavActive(pathname, item.href)
                  ? "bg-indigo-50 font-medium text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <span className="w-4 text-center text-xs opacity-70">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 border-t border-slate-200 pt-4 px-2">
          <LogoutButton className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900" />
          <AppBrandFooter variant="compact" />
        </div>
      </aside>

      <div className="flex-1 overflow-x-hidden">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <BackButton />
            </div>
          </div>
          {nav ? <div className="mt-4">{nav}</div> : null}
        </header>
        <main className="px-6 py-6">{children}</main>
        <div className="space-y-3 px-6 pb-6 md:hidden">
          <LogoutButton className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50" />
          <AppBrandFooter />
        </div>
      </div>
    </div>
  );
}
