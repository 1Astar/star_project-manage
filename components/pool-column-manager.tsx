"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPoolColumnAction,
  deletePoolColumnAction,
  savePoolTagOptionsAction,
} from "@/lib/actions";
import type { PoolColumnDef, PoolColumnType } from "@/lib/types";

const COLUMN_TYPES: { value: PoolColumnType; label: string }[] = [
  { value: "text", label: "文本" },
  { value: "number", label: "数字" },
  { value: "date", label: "日期" },
  { value: "checkbox", label: "勾选" },
  { value: "select", label: "单选" },
  { value: "url", label: "链接" },
];

export function PoolColumnManager({
  projectId,
  projectSlug,
  columnDefs,
  tagOptions,
}: {
  projectId: string;
  projectSlug: string;
  columnDefs: PoolColumnDef[];
  tagOptions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [columnType, setColumnType] = useState<PoolColumnType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [tagDraft, setTagDraft] = useState(tagOptions.join("、"));

  function addColumn(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createPoolColumnAction({
        projectId,
        projectSlug,
        label,
        columnType,
        options: optionsText
          .split(/[,，、]/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setLabel("");
      setOptionsText("");
      router.refresh();
    });
  }

  function removeColumn(defId: string) {
    if (!confirm("删除该自定义列？已有数据会保留在后台但不再显示。")) return;
    startTransition(async () => {
      await deletePoolColumnAction(defId, projectSlug);
      router.refresh();
    });
  }

  function saveTags() {
    startTransition(async () => {
      await savePoolTagOptionsAction({
        projectId,
        projectSlug,
        tagOptions: tagDraft
          .split(/[,，、]/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
      router.refresh();
    });
  }

  return (
    <section className="card p-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <div className="font-semibold">列与标签配置</div>
          <div className="text-xs text-slate-500">
            {columnDefs.length} 个自定义列 · 标签预设：{tagOptions.join("、")}
          </div>
        </div>
        <span className="text-sm text-blue-600">{open ? "收起" : "展开"}</span>
      </button>

      {open ? (
        <div className="mt-4 space-y-5 border-t border-slate-100 pt-4">
          <div>
            <div className="mb-2 text-sm font-medium">标签预设（多选来源）</div>
            <div className="flex flex-wrap gap-2">
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="硬件、软件、体验"
                className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={pending}
                onClick={saveTags}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                保存标签
              </button>
            </div>
          </div>

          <form onSubmit={addColumn} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="text-slate-500">新列名称</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                className="mt-1 block rounded-lg border border-slate-200 px-3 py-2"
                placeholder="如：负责人"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-500">类型</span>
              <select
                value={columnType}
                onChange={(e) => setColumnType(e.target.value as PoolColumnType)}
                className="mt-1 block rounded-lg border border-slate-200 px-3 py-2"
              >
                {COLUMN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            {columnType === "select" ? (
              <label className="text-sm">
                <span className="text-slate-500">选项（逗号分隔）</span>
                <input
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  className="mt-1 block min-w-[200px] rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="选项A, 选项B"
                />
              </label>
            ) : null}
            <button
              type="submit"
              disabled={pending || !label.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              添加列
            </button>
          </form>

          {columnDefs.length > 0 ? (
            <ul className="space-y-2">
              {columnDefs.map((def) => (
                <li
                  key={def.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span>
                    <strong>{def.label}</strong>
                    <span className="ml-2 text-slate-500">
                      {COLUMN_TYPES.find((t) => t.value === def.column_type)?.label}
                      {def.options.length ? ` · ${def.options.join("/")}` : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeColumn(def.id)}
                    className="text-red-600 hover:underline"
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">暂无自定义列，可按项目需要添加。</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
