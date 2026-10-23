"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  WORKBOOK_GRID_SHEETS,
  emptyGridRow,
  type BundleCommitResult,
  type GridRow,
  type GridSheetDef,
  type WorkbookGridState,
} from "@/lib/excel/workbook-bundle";

export function WorkbookGridPanel({
  projectSlug,
  defaultOpen = false,
}: {
  projectSlug: string;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, startTransition] = useTransition();
  const [activeKind, setActiveKind] = useState<GridSheetDef["kind"]>("learning");
  const [grid, setGrid] = useState<WorkbookGridState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BundleCommitResult | null>(null);

  const load = useCallback(() => {
    startTransition(async () => {
      setError(null);
      setResult(null);
      try {
        const res = await fetch(`/api/projects/${projectSlug}/workbook/grid`);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { grid: WorkbookGridState };
        setGrid(data.grid);
        setDirty(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      }
    });
  }, [projectSlug]);

  useEffect(() => {
    if (open && !grid) load();
  }, [open, grid, load]);

  const activeDef =
    WORKBOOK_GRID_SHEETS.find((s) => s.kind === activeKind) ??
    WORKBOOK_GRID_SHEETS[0];
  const activeSheet = grid?.sheets.find((s) => s.kind === activeKind);

  function updateCell(rowIndex: number, key: string, value: string) {
    if (!grid) return;
    setGrid({
      ...grid,
      sheets: grid.sheets.map((s) => {
        if (s.kind !== activeKind) return s;
        const rows = s.rows.map((r, i) =>
          i === rowIndex ? { ...r, [key]: value } : r
        );
        return { ...s, rows };
      }),
    });
    setDirty(true);
  }

  function addRow() {
    if (!grid) return;
    setGrid({
      ...grid,
      sheets: grid.sheets.map((s) =>
        s.kind === activeKind
          ? { ...s, rows: [...s.rows, emptyGridRow(activeKind)] }
          : s
      ),
    });
    setDirty(true);
  }

  function removeRow(rowIndex: number) {
    if (!grid) return;
    setGrid({
      ...grid,
      sheets: grid.sheets.map((s) =>
        s.kind === activeKind
          ? { ...s, rows: s.rows.filter((_, i) => i !== rowIndex) }
          : s
      ),
    });
    setDirty(true);
  }

  /** 从 Excel / 表格复制的 TSV：从当前格起向右、向下填 */
  function pasteAt(
    rowIndex: number,
    colKey: string,
    text: string
  ): boolean {
    if (!grid) return false;
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    if (lines.length <= 1 && !lines[0]?.includes("\t")) return false;

    const colKeys = activeDef.columns.map((c) => c.key);
    const startCol = colKeys.indexOf(colKey);
    if (startCol < 0) return false;

    setGrid({
      ...grid,
      sheets: grid.sheets.map((s) => {
        if (s.kind !== activeKind) return s;
        const rows = s.rows.map((r) => ({ ...r }));
        lines.forEach((line, li) => {
          const cells = line.split("\t");
          const ri = rowIndex + li;
          while (ri >= rows.length) {
            rows.push(emptyGridRow(activeKind));
          }
          cells.forEach((cell, ci) => {
            const key = colKeys[startCol + ci];
            if (key) rows[ri] = { ...rows[ri], [key]: cell };
          });
        });
        return { ...s, rows };
      }),
    });
    setDirty(true);
    return true;
  }

  function sync() {
    if (!grid) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectSlug}/workbook/grid`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grid }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { result: BundleCommitResult };
        setResult(data.result);
        setDirty(false);
        router.refresh();
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "同步失败");
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            总表网格编辑
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            预填当前项目数据，单元格可改；关联写标题（可空）。改完点同步写入，不必先下
            Excel。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {open ? "收起网格" : "打开网格"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {WORKBOOK_GRID_SHEETS.map((s) => (
              <button
                key={s.kind}
                type="button"
                onClick={() => setActiveKind(s.kind)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  activeKind === s.kind
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {s.sheetName}
                {grid
                  ? ` · ${
                      grid.sheets.find((x) => x.kind === s.kind)?.rows.length ??
                      0
                    }`
                  : ""}
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              onClick={load}
              className="ml-auto text-xs text-slate-500 hover:text-slate-800"
            >
              重新加载
            </button>
            <button
              type="button"
              disabled={pending || !grid}
              onClick={addRow}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              + 行
            </button>
            <button
              type="button"
              disabled={pending || !grid || !dirty}
              onClick={sync}
              className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              {pending ? "同步中…" : dirty ? "同步写入" : "已同步"}
            </button>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {result ? (
            <p className="text-xs text-emerald-700">
              已同步：新建 学习{result.created.learning}/竞品
              {result.created.competitor}/需求{result.created.requirement}/Bug
              {result.created.bug}；更新 学习{result.updated.learning}/竞品
              {result.updated.competitor}/需求{result.updated.requirement}/Bug
              {result.updated.bug}
              {result.pendingLinks.length
                ? `；未匹配 ${result.pendingLinks.slice(0, 3).join("、")}`
                : ""}
            </p>
          ) : null}

          {!grid && pending ? (
            <p className="text-xs text-slate-500">加载中…</p>
          ) : null}

          {grid && activeSheet ? (
            <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-100">
              <table className="min-w-full border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr>
                    <th className="w-8 border-b border-slate-200 px-1 py-2 text-left font-semibold text-slate-500">
                      #
                    </th>
                    {activeDef.columns.map((col) => (
                      <th
                        key={col.key}
                        className="border-b border-slate-200 px-1 py-2 text-left font-semibold text-slate-600"
                        style={{ minWidth: col.width }}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="w-10 border-b border-slate-200 px-1 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {activeSheet.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activeDef.columns.length + 2}
                        className="px-3 py-8 text-center text-slate-400"
                      >
                        暂无行。点「+ 行」新增，或从 Excel 导入后再打开。
                      </td>
                    </tr>
                  ) : (
                    activeSheet.rows.map((row, ri) => (
                      <GridDataRow
                        key={`${activeKind}-${ri}`}
                        index={ri}
                        row={row}
                        columns={activeDef.columns}
                        onChange={updateCell}
                        onPasteAt={pasteAt}
                        onRemove={removeRow}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function GridDataRow({
  index,
  row,
  columns,
  onChange,
  onPasteAt,
  onRemove,
}: {
  index: number;
  row: GridRow;
  columns: GridSheetDef["columns"];
  onChange: (rowIndex: number, key: string, value: string) => void;
  onPasteAt: (rowIndex: number, colKey: string, text: string) => boolean;
  onRemove: (rowIndex: number) => void;
}) {
  return (
    <tr className="odd:bg-white even:bg-slate-50/60">
      <td className="border-b border-slate-100 px-1 py-0.5 text-slate-400">
        {index + 1}
      </td>
      {columns.map((col) => (
        <td key={col.key} className="border-b border-slate-100 p-0.5">
          <input
            value={row[col.key] ?? ""}
            onChange={(e) => onChange(index, col.key, e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text/plain");
              if (onPasteAt(index, col.key, text)) {
                e.preventDefault();
              }
            }}
            className="w-full min-w-[5rem] rounded border border-transparent bg-transparent px-1.5 py-1 hover:border-slate-200 focus:border-indigo-300 focus:bg-white focus:outline-none"
          />
        </td>
      ))}
      <td className="border-b border-slate-100 px-1">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-slate-400 hover:text-red-600"
          title="删除行"
        >
          ×
        </button>
      </td>
    </tr>
  );
}
