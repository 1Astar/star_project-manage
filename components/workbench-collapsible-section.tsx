"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  storageKey: string;
  title: string;
  subtitle?: string;
  /** 默认是否展开 */
  defaultOpen?: boolean;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function WorkbenchCollapsibleSection({
  storageKey,
  title,
  subtitle,
  defaultOpen = true,
  headerRight,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === "0") setOpen(false);
      else if (raw === "1") setOpen(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [storageKey]);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <section className={cn("rounded-xl border border-slate-200 bg-white", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
          aria-expanded={open}
        >
          <span
            className={cn(
              "mt-0.5 inline-block text-slate-400 transition-transform",
              open ? "rotate-90" : ""
            )}
            aria-hidden
          >
            ▸
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-800">{title}</span>
            {subtitle ? (
              <span className="mt-0.5 block text-xs text-slate-500">{subtitle}</span>
            ) : null}
          </span>
        </button>
        <div className="flex items-center gap-3 text-xs">{headerRight}</div>
      </div>
      {open ? <div className="p-4">{children}</div> : null}
      {!open ? (
        <p className="px-4 py-2.5 text-xs text-slate-400">已收起 · 点击标题展开</p>
      ) : null}
    </section>
  );
}
