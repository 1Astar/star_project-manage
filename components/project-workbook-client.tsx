"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { WorkbookInstance } from "@fortune-sheet/react";
import type { ProjectWorkbook } from "@/lib/types";

const FortuneSheetEditor = dynamic(
  () =>
    import("@/components/fortune-sheet-editor").then((m) => m.FortuneSheetEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
        加载表格编辑器…
      </div>
    ),
  }
);

type WorkbookMeta = Omit<ProjectWorkbook, "sheet_data">;

export function ProjectWorkbookClient({
  projectSlug,
  initialWorkbooks,
}: {
  projectSlug: string;
  initialWorkbooks: WorkbookMeta[];
}) {
  const [list, setList] = useState(initialWorkbooks);
  const [activeId, setActiveId] = useState<string | null>(
    initialWorkbooks[0]?.id ?? null
  );
  const [title, setTitle] = useState(initialWorkbooks[0]?.title ?? "");
  const [sheetData, setSheetData] = useState<Array<Record<string, unknown>> | null>(
    null
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editorRef = useRef<WorkbookInstance | null>(null);
  const latestData = useRef<Array<Record<string, unknown>> | null>(null);

  const loadWorkbook = useCallback(
    (workbookId: string) => {
      startTransition(async () => {
        setError(null);
        setMessage(null);
        try {
          const res = await fetch(
            `/api/projects/${projectSlug}/workbooks/${workbookId}`
          );
          if (!res.ok) throw new Error(await res.text());
          const data = (await res.json()) as { workbook: ProjectWorkbook };
          setActiveId(data.workbook.id);
          setTitle(data.workbook.title);
          setSheetData(data.workbook.sheet_data);
          latestData.current = data.workbook.sheet_data;
          setDirty(false);
        } catch (e) {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      });
    },
    [projectSlug]
  );

  useEffect(() => {
    if (activeId && !sheetData) loadWorkbook(activeId);
  }, [activeId, sheetData, loadWorkbook]);

  function createWorkbook() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectSlug}/workbooks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "未命名表格" }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { workbook: ProjectWorkbook };
        const { sheet_data: _s, ...meta } = data.workbook;
        setList((prev) => [meta, ...prev]);
        setActiveId(data.workbook.id);
        setTitle(data.workbook.title);
        setSheetData(data.workbook.sheet_data);
        latestData.current = data.workbook.sheet_data;
        setDirty(false);
        setMessage("已新建表格");
      } catch (e) {
        setError(e instanceof Error ? e.message : "创建失败");
      }
    });
  }

  function save() {
    if (!activeId) return;
    const fromApi = editorRef.current?.getAllSheets?.() as
      | Array<Record<string, unknown>>
      | undefined;
    const payload = fromApi?.length
      ? fromApi
      : latestData.current ?? sheetData;
    if (!payload) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(
          `/api/projects/${projectSlug}/workbooks/${activeId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, sheet_data: payload }),
          }
        );
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { workbook: ProjectWorkbook };
        const { sheet_data: _s, ...meta } = data.workbook;
        setList((prev) =>
          prev.map((w) => (w.id === meta.id ? meta : w)).sort((a, b) =>
            b.updated_at.localeCompare(a.updated_at)
          )
        );
        setSheetData(data.workbook.sheet_data);
        latestData.current = data.workbook.sheet_data;
        setDirty(false);
        setMessage("已保存");
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  function removeActive() {
    if (!activeId) return;
    if (!window.confirm("删除这份表格？不可恢复。")) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(
          `/api/projects/${projectSlug}/workbooks/${activeId}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error(await res.text());
        const next = list.filter((w) => w.id !== activeId);
        setList(next);
        setActiveId(next[0]?.id ?? null);
        setTitle(next[0]?.title ?? "");
        setSheetData(null);
        latestData.current = null;
        setDirty(false);
        if (next[0]) loadWorkbook(next[0].id);
        setMessage("已删除");
      } catch (e) {
        setError(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">工作簿</h2>
          <p className="mt-1 text-sm text-slate-500">
            飞书表级基础编辑：字号、对齐、合并、插图、筛选。保存到项目；可导出
            xlsx。本期不同步学习/竞品/需求/Bug（仍用总表导入或网格）。
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={createWorkbook}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          新建表格
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {list.length === 0 ? (
          <p className="text-sm text-slate-400">还没有表格，点「新建表格」开始。</p>
        ) : (
          list.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                if (dirty && !window.confirm("有未保存修改，切换将丢弃？")) return;
                setSheetData(null);
                setActiveId(w.id);
                setTitle(w.title);
                loadWorkbook(w.id);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                activeId === w.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {w.title}
            </button>
          ))
        )}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      {activeId ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              placeholder="表格标题"
            />
            <button
              type="button"
              disabled={pending || !dirty}
              onClick={save}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              {pending ? "保存中…" : dirty ? "保存" : "已保存"}
            </button>
            <a
              href={`/api/projects/${projectSlug}/workbooks/${activeId}/export`}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              导出 xlsx
            </a>
            <button
              type="button"
              disabled={pending}
              onClick={removeActive}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              删除
            </button>
          </div>

          {sheetData ? (
            <FortuneSheetEditor
              key={activeId}
              data={sheetData}
              workbookRef={editorRef}
              onChange={(next) => {
                latestData.current = next;
                setDirty(true);
              }}
            />
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">
              {pending ? "加载中…" : "选择或新建一张表"}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
