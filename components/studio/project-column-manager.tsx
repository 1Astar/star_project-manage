"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StudioProjectColumnDef, StudioProjectColumnType } from "@/lib/studio/types";

const COLUMN_TYPES: { value: StudioProjectColumnType; label: string }[] = [
  { value: "text", label: "文本" },
  { value: "number", label: "数字" },
  { value: "date", label: "日期" },
  { value: "checkbox", label: "勾选" },
  { value: "select", label: "单选" },
  { value: "url", label: "链接" },
];

export function ProjectColumnManager({
  columns,
}: {
  columns: StudioProjectColumnDef[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [columnType, setColumnType] = useState<StudioProjectColumnType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addColumn(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/project-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          columnType,
          options: optionsText
            .split(/[,，、]/)
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "添加失败");
        return;
      }
      setLabel("");
      setOptionsText("");
      setColumnType("text");
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setPending(false);
    }
  }

  async function removeColumn(id: string) {
    if (!confirm("删除该自定义列？已有数据会保留在后台但不再显示。")) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/project-columns/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "删除失败");
        return;
      }
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs"
      >
        <span className="font-medium text-slate-600">
          自定义列 · {columns.length} 个
        </span>
        <span className="text-indigo-600">{open ? "收起" : "管理"}</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-slate-100 px-3 py-3">
          {columns.length > 0 ? (
            <ul className="space-y-1.5">
              {columns.map((col) => (
                <li
                  key={col.id}
                  className="flex items-center justify-between gap-2 text-xs text-slate-600"
                >
                  <span>
                    {col.label}
                    <span className="ml-1 text-slate-400">
                      ({COLUMN_TYPES.find((t) => t.value === col.columnType)?.label ?? col.columnType})
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void removeColumn(col.id)}
                    className="text-red-500 hover:underline disabled:opacity-50"
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">暂无自定义列</p>
          )}

          <form onSubmit={addColumn} className="grid gap-2 sm:grid-cols-[1fr_100px_1fr_auto]">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="列名"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              required
            />
            <select
              value={columnType}
              onChange={(e) => setColumnType(e.target.value as StudioProjectColumnType)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            >
              {COLUMN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder={columnType === "select" ? "选项，顿号分隔" : "选项（单选才需要）"}
              disabled={columnType !== "select"}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={pending || !label.trim()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              添加
            </button>
          </form>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
