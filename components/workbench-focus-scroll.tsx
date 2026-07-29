"use client";

import { useEffect } from "react";

/** 从 /todos? 或 /?focus=pm-today 滚到今日要做 */
export function WorkbenchFocusScroll({ focus }: { focus?: string }) {
  useEffect(() => {
    if (focus !== "pm-today") return;
    const el = document.getElementById("pm-today");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);
  return null;
}
