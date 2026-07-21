"use client";

import { useState } from "react";
import Link from "next/link";

export type WorkbenchBlockerItem = {
  taskId: string;
  title: string;
  blocker: string;
  projectId: string;
  projectTitle: string;
};

export function WorkbenchBlockers({ items }: { items: WorkbenchBlockerItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <span className="relative ml-2 inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-medium text-red-600 underline-offset-2 hover:underline"
        aria-expanded={open}
      >
        阻塞 {items.length}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-red-100 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-red-700/80">未完成且填了阻塞的任务</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              关闭
            </button>
          </div>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <li key={item.taskId}>
                <Link
                  href={`/projects/${item.projectId}/tasks?view=studio`}
                  className="block rounded-lg border border-slate-100 px-3 py-2 hover:border-red-200 hover:bg-red-50/40"
                  onClick={() => setOpen(false)}
                >
                  <div className="text-xs text-slate-400">{item.projectTitle}</div>
                  <div className="mt-0.5 truncate text-sm font-medium text-slate-800">
                    {item.title || "未命名任务"}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-red-700/90">{item.blocker}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </span>
  );
}
