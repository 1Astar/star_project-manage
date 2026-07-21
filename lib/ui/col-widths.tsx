"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function clampColWidth(n: number) {
  return Math.min(800, Math.max(48, n));
}

export function readColWidths(
  storageKey: string,
  defaults: Record<string, number>
): Record<string, number> {
  if (typeof window === "undefined") return { ...defaults };
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out = { ...defaults };
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number") out[k] = clampColWidth(v);
    }
    return out;
  } catch {
    return { ...defaults };
  }
}

export function writeColWidths(storageKey: string, widths: Record<string, number>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(widths));
}

/** 列宽状态 + 拖拽改宽；可选 syncKey 同步到 studio_app_settings */
export function useColWidths(
  storageKey: string,
  defaults: Record<string, number>,
  opts?: { syncKey?: string }
) {
  const [widths, setWidths] = useState(defaults);
  const resizeRef = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  useEffect(() => {
    setWidths(readColWidths(storageKey, defaultsRef.current));
    const onHydrated = () => {
      setWidths(readColWidths(storageKey, defaultsRef.current));
    };
    window.addEventListener("star-pm:prefs-hydrated", onHydrated);
    return () => window.removeEventListener("star-pm:prefs-hydrated", onHydrated);
  }, [storageKey]);

  const persist = useCallback(
    (next: Record<string, number>) => {
      setWidths(next);
      writeColWidths(storageKey, next);
      if (opts?.syncKey) {
        void import("@/lib/ui/synced-pref").then(({ pushSyncedPref }) => {
          pushSyncedPref(opts.syncKey!, next);
        });
      }
    },
    [storageKey, opts?.syncKey]
  );

  const colW = useCallback(
    (key: string) => widths[key] ?? defaults[key] ?? 120,
    [widths, defaults]
  );

  const onResizeStart = useCallback(
    (key: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startW = widths[key] ?? defaults[key] ?? 120;
      resizeRef.current = { key, startX: e.clientX, startW };
      let lastW = startW;
      const onMove = (ev: MouseEvent) => {
        const cur = resizeRef.current;
        if (!cur) return;
        lastW = clampColWidth(cur.startW + (ev.clientX - cur.startX));
        setWidths((prev) => ({ ...prev, [cur.key]: lastW }));
      };
      const onUp = () => {
        const cur = resizeRef.current;
        resizeRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (!cur) return;
        const next = { ...widths, [cur.key]: lastW };
        // merge latest from setState path
        setWidths((prev) => {
          const merged = { ...prev, [cur.key]: lastW };
          writeColWidths(storageKey, merged);
          if (opts?.syncKey) {
            void import("@/lib/ui/synced-pref").then(({ pushSyncedPref }) => {
              pushSyncedPref(opts.syncKey!, merged);
            });
          }
          return merged;
        });
        void next;
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [widths, defaults, storageKey, opts?.syncKey]
  );

  return { widths, setWidths: persist, colW, onResizeStart };
}

export function ResizableTh({
  colKey,
  width,
  onResizeStart,
  children,
  className,
  style,
  sticky,
}: {
  colKey: string;
  width: number;
  onResizeStart: (key: string, e: React.MouseEvent) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  sticky?: boolean;
}) {
  return (
    <th
      className={cn(
        "relative px-3 py-2.5 font-medium",
        sticky && "sticky z-10 bg-slate-50 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]",
        className
      )}
      style={{ width, minWidth: width, ...style }}
    >
      {children}
      <span
        role="separator"
        aria-orientation="vertical"
        onMouseDown={(e) => onResizeStart(colKey, e)}
        className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize hover:bg-indigo-400/50"
      />
    </th>
  );
}
