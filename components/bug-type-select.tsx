"use client";

import { useCallback, useEffect, useState } from "react";
import type { BugTypeOption } from "@/lib/bugs/bug-type-catalog";
import { BUG_TYPE_LABELS } from "@/lib/types";
import { invalidateBugTypeLabelCache } from "@/components/bug-type-label";

const ADD_SENTINEL = "__add_bug_type__";

const FALLBACK_OPTIONS: BugTypeOption[] = (Object.keys(BUG_TYPE_LABELS) as Array<
  keyof typeof BUG_TYPE_LABELS
>).map((key) => ({
  key,
  label: BUG_TYPE_LABELS[key],
  builtin: true,
}));

type Props = {
  value: string;
  onChange: (key: string) => void;
  className?: string;
  selectClassName?: string;
  disabled?: boolean;
};

export function BugTypeSelect({
  value,
  onChange,
  className = "",
  selectClassName = "min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1",
  disabled = false,
}: Props) {
  const [options, setOptions] = useState<BugTypeOption[]>(FALLBACK_OPTIONS);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/bug-types");
      const data = await res.json();
      if (res.ok && Array.isArray(data.options)) {
        setOptions(data.options as BugTypeOption[]);
      }
    } catch {
      /* 保留内置列表 */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submitNewType() {
    const label = newLabel.trim();
    if (!label) {
      setError("请填写类型名称");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bug-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "添加失败");
        return;
      }
      if (Array.isArray(data.options)) {
        setOptions(data.options as BugTypeOption[]);
      }
      const key = data.entry?.key as string | undefined;
      if (key) onChange(key);
      invalidateBugTypeLabelCache();
      setNewLabel("");
      setAdding(false);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectChange(next: string) {
    if (next === ADD_SENTINEL) {
      setAdding(true);
      setError(null);
      return;
    }
    onChange(next);
  }

  const hasValue = options.some((o) => o.key === value);

  return (
    <div className={`space-y-1 ${className}`}>
      <select
        value={hasValue ? value : value || "code"}
        onChange={(e) => handleSelectChange(e.target.value)}
        disabled={disabled || loading}
        className={selectClassName}
      >
        {!hasValue && value ? (
          <option value={value}>{value}</option>
        ) : null}
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
            {!o.builtin ? "（自定义）" : ""}
          </option>
        ))}
        <option value={ADD_SENTINEL}>＋ 添加类型…</option>
      </select>
      {adding ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitNewType();
              }
              if (e.key === "Escape") {
                setAdding(false);
                setNewLabel("");
                setError(null);
              }
            }}
            placeholder="新类型名称，如：知识库"
            maxLength={40}
            disabled={loading}
            className="min-w-[8rem] flex-1 rounded-md border border-indigo-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
            autoFocus
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void submitNewType()}
            className="rounded-md bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            {loading ? "…" : "添加"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setAdding(false);
              setNewLabel("");
              setError(null);
            }}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
          >
            取消
          </button>
        </div>
      ) : null}
      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
    </div>
  );
}
