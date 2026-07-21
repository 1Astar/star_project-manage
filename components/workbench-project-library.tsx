"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProjectLibraryCard } from "@/components/project-library-card";
import {
  applyLibraryPrefs,
  libraryEditorRows,
  readWorkbenchLibraryPrefs,
  writeWorkbenchLibraryPrefs,
  type WorkbenchLibraryPrefs,
} from "@/lib/workbench/library-prefs";
import type { Project } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

export function WorkbenchProjectLibrary({
  projects,
  nextActionDrafts,
}: {
  projects: Project[];
  nextActionDrafts: Record<string, string>;
}) {
  const [prefs, setPrefs] = useState<WorkbenchLibraryPrefs>({ order: [], hidden: [] });
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(readWorkbenchLibraryPrefs());
    setReady(true);
  }, []);

  const persist = useCallback((next: WorkbenchLibraryPrefs) => {
    setPrefs(next);
    writeWorkbenchLibraryPrefs(next);
  }, []);

  const visibleTree = useMemo(
    () => applyLibraryPrefs(projects, prefs),
    [projects, prefs]
  );

  const editorRows = useMemo(
    () => libraryEditorRows(projects, prefs),
    [projects, prefs]
  );

  function toggleVisible(id: string) {
    const hidden = new Set(prefs.hidden);
    if (hidden.has(id)) hidden.delete(id);
    else hidden.add(id);
    const order =
      prefs.order.length > 0
        ? prefs.order
        : editorRows.map((r) => r.project.id);
    persist({ order, hidden: [...hidden] });
  }

  function onDragStart(id: string) {
    setDragId(id);
  }

  function onDrop(overId: string) {
    if (!dragId || dragId === overId) {
      setDragId(null);
      return;
    }
    const ids = editorRows.map((r) => r.project.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) {
      setDragId(null);
      return;
    }
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    persist({ order: ids, hidden: prefs.hidden });
    setDragId(null);
  }

  function resetPrefs() {
    persist({ order: [], hidden: [] });
  }

  return (
    <section className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-500">项目库</h2>
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-slate-600 hover:text-indigo-600 hover:underline"
          >
            {editing ? "收起调整" : "调整显示"}
          </button>
          <Link href="/projects" className="text-indigo-600 hover:underline">
            查看全部
          </Link>
        </div>
      </div>

      {editing ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              勾选显示 · 拖拽排序 · 配置保存在本浏览器
            </p>
            <button
              type="button"
              onClick={resetPrefs}
              className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
            >
              恢复默认
            </button>
          </div>
          <ul className="space-y-1">
            {editorRows.map((row) => (
              <li
                key={row.project.id}
                draggable
                onDragStart={() => onDragStart(row.project.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(row.project.id)}
                className={cn(
                  "flex cursor-grab items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 active:cursor-grabbing",
                  dragId === row.project.id && "opacity-50",
                  !row.visible && "bg-slate-50 opacity-70"
                )}
              >
                <span className="select-none text-slate-300" aria-hidden>
                  ⋮⋮
                </span>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={row.visible}
                    onChange={() => toggleVisible(row.project.id)}
                    className="rounded border-slate-300"
                  />
                  <span
                    className={cn(
                      "truncate text-sm text-slate-800",
                      row.depth === 1 && "pl-3 text-slate-600"
                    )}
                  >
                    {row.depth === 1 ? "↳ " : ""}
                    {row.project.title}
                  </span>
                </label>
              </li>
            ))}
            {editorRows.length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-400">暂无非归档项目</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {(() => {
        const tree = ready ? visibleTree : applyLibraryPrefs(projects, { order: [], hidden: [] });
        if (tree.length === 0) {
          return (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
              当前没有要显示的项目。点「调整显示」打开开关，或
              <Link href="/projects" className="ml-1 text-indigo-600 hover:underline">
                查看全部项目
              </Link>
            </p>
          );
        }
        return (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {tree.map(({ project: p, depth, parentTitle }) => (
              <ProjectLibraryCard
                key={p.id}
                project={p}
                depth={depth}
                parentTitle={parentTitle}
                nextActionDraft={nextActionDrafts[p.id]}
              />
            ))}
          </div>
        );
      })()}
    </section>
  );
}
