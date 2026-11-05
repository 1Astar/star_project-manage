"use client";

import { useEffect, useState } from "react";
import type { OutlineItem } from "@/lib/wiki-pages/outline";

/**
 * 悬浮大纲（非常驻侧栏）：
 * - 默认只显示右侧短线（图1）
 * - 悬停整条导航时展开标题（图2）；当前章标题与短线高亮
 * - 始终落在顶栏（含项目 Tab）下方，不盖住导航
 */
export function PageFloatingToc({
  items,
  className = "",
}: {
  items: OutlineItem[];
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const [expanded, setExpanded] = useState(false);
  const [topPx, setTopPx] = useState(176);

  useEffect(() => {
    const header = document.getElementById("workbench-chrome-header");
    if (!header) return;
    const sync = () => {
      const bottom = header.getBoundingClientRect().bottom;
      // 顶栏底边 + 间距；至少留出 Tab 行
      setTopPx(Math.max(144, Math.ceil(bottom + 8)));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(header);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

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
        // 内容带内垂直居中；z 低于 header(z-20)，不盖 Tab
        "pointer-events-none fixed bottom-6 right-3 z-10 hidden xl:flex xl:items-center xl:justify-end",
        className,
      ].join(" ")}
      style={{ top: topPx }}
      aria-label="页面大纲"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setExpanded(false);
        }
      }}
    >
      <nav
        className={[
          "pointer-events-auto flex max-h-full flex-col overflow-y-auto overflow-x-visible",
          "rounded-xl transition-[padding,background-color,box-shadow,border-color] duration-150",
          expanded
            ? "border border-slate-200/90 bg-white/95 px-2.5 py-2 shadow-lg shadow-slate-900/8 backdrop-blur"
            : "border border-transparent bg-transparent px-1.5 py-1",
        ].join(" ")}
      >
        <ul className="flex flex-col gap-1.5">
          {items.map((it) => {
            const active = it.id === activeId;
            const barW =
              it.level === 1 ? "w-4" : it.level === 3 ? "w-2" : "w-3";
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => jump(it.id)}
                  title={it.text}
                  className="group flex w-full items-center justify-end gap-2 rounded-md py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  <span
                    className={[
                      "min-w-0 truncate text-right text-[12px] leading-snug transition-all duration-150",
                      expanded
                        ? "max-w-[10.5rem] opacity-100"
                        : "max-w-0 overflow-hidden opacity-0",
                      it.level === 1 ? "font-medium" : "",
                      it.level === 3 ? "text-[11px]" : "",
                      active
                        ? "text-sky-700"
                        : "text-slate-500 group-hover:text-slate-800",
                    ].join(" ")}
                  >
                    {it.text}
                  </span>
                  <span
                    className={[
                      "relative h-1 shrink-0 rounded-full transition-colors",
                      barW,
                      // 扩大热区，方便点到短线
                      "after:absolute after:-inset-y-2 after:-inset-x-1.5 after:content-['']",
                      active ? "bg-sky-500" : "bg-slate-300 group-hover:bg-slate-400",
                    ].join(" ")}
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
