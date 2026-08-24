"use client";

import { useEffect, useState } from "react";
import { bugTypeLabel } from "@/lib/bugs/bug-type-catalog";
import { BUG_TYPE_LABELS } from "@/lib/types";

let labelCache: Record<string, string> | null = null;
let labelCachePromise: Promise<Record<string, string>> | null = null;

async function loadLabelMap(): Promise<Record<string, string>> {
  if (labelCache) return labelCache;
  if (!labelCachePromise) {
    labelCachePromise = (async () => {
      try {
        const res = await fetch("/api/bug-types");
        const data = await res.json();
        if (res.ok && Array.isArray(data.options)) {
          const map: Record<string, string> = { ...BUG_TYPE_LABELS };
          for (const o of data.options as Array<{ key: string; label: string }>) {
            map[o.key] = o.label;
          }
          labelCache = map;
          return map;
        }
      } catch {
        /* ignore */
      }
      labelCache = { ...BUG_TYPE_LABELS };
      return labelCache;
    })();
  }
  return labelCachePromise;
}

export function BugTypeLabel({ typeKey }: { typeKey: string }) {
  const [text, setText] = useState(() => bugTypeLabel(typeKey, BUG_TYPE_LABELS));

  useEffect(() => {
    let cancelled = false;
    void loadLabelMap().then((map) => {
      if (!cancelled) setText(bugTypeLabel(typeKey, map));
    });
    return () => {
      cancelled = true;
    };
  }, [typeKey]);

  return <>{text}</>;
}

export function invalidateBugTypeLabelCache() {
  labelCache = null;
  labelCachePromise = null;
}
