"use client";

import {
  REQUIREMENT_KANBAN_COLUMNS,
  REQUIREMENT_STATUS_HINT,
  applyLifecycleStatus,
  requirementLifecycleStatus,
  type RequirementLifecycleStatus,
} from "@/lib/requirement-status";
import { cn } from "@/lib/utils";

type Props = {
  tags: string[];
  onChange: (next: string[]) => void;
  className?: string;
  /** 紧凑行内样式（表格单元格） */
  compact?: boolean;
};

export function RequirementStatusSelect({ tags, onChange, className, compact }: Props) {
  const value = requirementLifecycleStatus({ status_tags: tags });

  return (
    <div className={cn("space-y-1", className)}>
      {!compact ? (
        <label className="block text-xs text-slate-500">
          需求状态
          <span className="mt-0.5 block font-normal text-[11px] text-slate-400">
            {REQUIREMENT_STATUS_HINT}
          </span>
        </label>
      ) : null}
      <select
        value={value}
        onChange={(e) =>
          onChange(
            applyLifecycleStatus(tags, e.target.value as RequirementLifecycleStatus)
          )
        }
        className={cn(
          "rounded-lg border border-slate-200 bg-white text-slate-800",
          compact ? "w-full max-w-[8.5rem] px-1.5 py-1 text-[11px]" : "mt-1 w-full px-3 py-2 text-sm"
        )}
        aria-label="需求状态"
      >
        {REQUIREMENT_KANBAN_COLUMNS.map((col) => (
          <option key={col} value={col}>
            {col}
          </option>
        ))}
      </select>
    </div>
  );
}
