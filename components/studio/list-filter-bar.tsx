"use client";

import { useRouter } from "next/navigation";

export type ListFilterOption = { id: string; label: string };

type ListFilterBarProps = {
  basePath: string;
  currentValue: string | null;
  options: ListFilterOption[];
  allLabel?: string;
  paramName?: string;
  label?: string;
};

export function ListFilterBar({
  basePath,
  currentValue,
  options,
  allLabel = "全部",
  paramName = "project",
  label = "筛选",
}: ListFilterBarProps) {
  const router = useRouter();

  function handleChange(value: string) {
    if (!value) {
      router.push(basePath);
      return;
    }
    router.push(`${basePath}?${paramName}=${encodeURIComponent(value)}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <select
        value={currentValue ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
      >
        <option value="">{allLabel}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      {currentValue ? (
        <button
          type="button"
          onClick={() => handleChange("")}
          className="text-xs text-indigo-600 hover:underline"
        >
          清除筛选
        </button>
      ) : null}
    </div>
  );
}

export const INBOX_UNLINKED_FILTER = "__none__";
