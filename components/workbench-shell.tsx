"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { AppBrandFooter } from "@/components/app-brand-footer";
import { LogoutButton } from "@/components/logout-button";
import { appVersionLabel } from "@/lib/app-meta";
import { cn } from "@/lib/utils";

export const WORKBENCH_NAV = [
  { href: "/", label: "今日工作台", icon: "◉" },
  { href: "/projects", label: "项目库", icon: "▣" },
  { href: "/stream", label: "灵感流", icon: "✦" },
  { href: "/todos", label: "我的待办", icon: "☑" },
  { href: "/evolution", label: "演进记录", icon: "↻" },
  { href: "/assets", label: "资料 / 链接", icon: "🔗" },
  { href: "/keys", label: "密钥索引", icon: "🔑" },
  { href: "/settings", label: "设置", icon: "⚙" },
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
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  nav?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 px-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Star PM
            </div>
            <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {appVersionLabel()}
            </span>
          </div>
          <div className="mt-1 text-sm font-bold text-slate-800">个人项目操作台</div>
        </div>
        <nav className="space-y-0.5">
          {WORKBENCH_NAV.map((item) => (
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
