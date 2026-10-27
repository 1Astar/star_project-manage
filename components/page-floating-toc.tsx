"use client";

import { useEffect, useState } from "react";
import type { OutlineItem } from "@/lib/wiki-pages/outline";

/**
 * Notion 风右侧悬浮大纲：点标题滚动定位，滚动时高亮当前章节。
 */
export function PageFloatingToc({
  items,
  className = "",
}: {
  items: OutlineItem[];
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (items.length === 0) return;

    const nodes = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop
          );
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-12% 0px -70% 0px",
        threshold: [0, 0.25, 1],
      }
    );

    for (const n of nodes) observer.observe(n);
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  function jump(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
    try {
      history.replaceState(null, "", `#${id}`);
    } catch {
      /* ignore */
    }
  }

  return (
    <aside
      className={[
        "pointer-events-none fixed right-4 top-24 z-30 hidden w-44 xl:block",
        className,
      ].join(" ")}
      aria-label="页面大纲"
    >
      <nav className="pointer-events-auto max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2.5 shadow-lg shadow-slate-900/5 backdrop-blur">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          大纲
        </p>
        <ul className="space-y-0.5">
          {items.map((it) => {
            const active = it.id === activeId;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => jump(it.id)}
                  className={[
                    "block w-full truncate rounded-md px-2 py-1 text-left text-[12px] leading-snug transition",
                    it.level === 1 ? "font-medium" : "",
                    it.level === 3 ? "pl-4 text-[11px]" : "",
                    it.level === 2 ? "pl-2" : "",
                    active
                      ? "bg-sky-50 text-sky-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
                  ].join(" ")}
                  title={it.text}
                >
                  {it.text}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
