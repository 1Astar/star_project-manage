import type { TaskStatus } from "@/lib/types";
import { TASK_STATUS_LABELS } from "@/lib/types";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  return (
    <span className={cn("badge", `badge-${status}`, className)}>
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

export function ProgressRing({ percent }: { percent: number }) {
  const radius = 36;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={radius * 2} height={radius * 2} className="shrink-0">
      <circle
        stroke="#e2e8f0"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      <circle
        stroke="#2563eb"
        fill="transparent"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        style={{ strokeDashoffset: offset, transition: "stroke-dashoffset 0.4s ease" }}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        transform={`rotate(-90 ${radius} ${radius})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#0f172a"
      >
        {percent}%
      </text>
    </svg>
  );
}

export function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const tones = {
    default: "text-slate-900",
    danger: "text-red-600",
    warning: "text-amber-600",
    success: "text-green-600",
  };

  return (
    <div className="card p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold", tones[tone])}>{value}</div>
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  nav,
  children,
  actions,
  showHomeLink = true,
}: {
  title: string;
  subtitle?: string;
  nav?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  showHomeLink?: boolean;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link href="/" className="text-xs font-semibold uppercase tracking-wider text-blue-600 hover:text-blue-700">
              Star PM
            </Link>
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {showHomeLink ? (
              <Link
                href="/"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                返回总览
              </Link>
            ) : null}
            <Link
              href="/todos"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              我的待办
            </Link>
            <LogoutButton />
          </div>
        </div>
        {nav ? (
          <div className="mx-auto max-w-7xl border-t border-slate-100 px-6 py-2">{nav}</div>
        ) : null}
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}

export function ProjectNav({ projectId, slug }: { projectId: string; slug: string }) {
  const base = `/projects/${slug || projectId}`;
  const links = [
    { href: base, label: "总览" },
    { href: `${base}/board`, label: "需求看板" },
    { href: `${base}/prototype`, label: "原型工作区" },
    { href: `${base}/gantt`, label: "甘特图" },
    { href: `${base}/hours`, label: "工时统计" },
    { href: `${base}/import`, label: "Excel 导入" },
    { href: `${base}/settings`, label: "设置" },
    { href: "/todos", label: "我的待办" },
    { href: "/ui-preview", label: "UI 方向" },
  ];

  return (
    <nav className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
