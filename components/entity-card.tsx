"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EntityCardProps = {
  title: string;
  description?: string | null;
  /** 状态文案或节点 */
  status?: ReactNode;
  /** 标签条（优先级、板块等） */
  tags?: ReactNode;
  /** 左侧图标 / emoji */
  icon?: ReactNode;
  /** 右上角操作按钮区 */
  actions?: ReactNode;
  /** 展开后的详情 */
  details?: ReactNode;
  /** 默认是否展开 */
  defaultExpanded?: boolean;
  className?: string;
  /** 点击标题区 */
  onOpen?: () => void;
  /** 外部控制展开 */
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
  /** 看板等紧凑密度 */
  compact?: boolean;
};

/**
 * 跨实体复用的展示卡：标题 / 描述 / 状态 / 标签 / 图标 / 按钮 / 展开详情。
 * 不做业务假设；业务侧传入 tags、actions、details。
 */
export function EntityCard({
  title,
  description,
  status,
  tags,
  icon,
  actions,
  details,
  defaultExpanded = false,
  className,
  onOpen,
  expanded: controlledExpanded,
  onExpandedChange,
  compact = false,
}: EntityCardProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultExpanded);
  const expanded =
    controlledExpanded !== undefined ? controlledExpanded : uncontrolled;
  const setExpanded = (open: boolean) => {
    onExpandedChange?.(open);
    if (controlledExpanded === undefined) setUncontrolled(open);
  };
  const hasDetails = details != null && details !== false && details !== "";

  return (
    <article
      className={cn(
        "flex flex-col border border-slate-200 bg-white shadow-sm transition hover:border-indigo-100",
        compact ? "rounded-lg" : "rounded-xl",
        className
      )}
    >
      <div className={cn("flex gap-3", compact ? "p-3" : "p-4")}>
        {icon ? <div className="shrink-0 pt-0.5 text-lg">{icon}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <button
              type="button"
              className={cn(
                "min-w-0 text-left font-medium text-slate-800",
                compact ? "text-sm" : "",
                onOpen || hasDetails ? "hover:text-indigo-700" : ""
              )}
              onClick={() => {
                if (onOpen) onOpen();
                else if (hasDetails) setExpanded(!expanded);
              }}
            >
              {title}
            </button>
            {status ? <div className="shrink-0">{status}</div> : null}
          </div>
          {tags ? (
            <div className={cn("flex flex-wrap gap-1.5", compact ? "mt-1.5" : "mt-2")}>
              {tags}
            </div>
          ) : null}
          {description ? (
            <p
              className={cn(
                "line-clamp-3 text-slate-500",
                compact ? "mt-1.5 text-[11px]" : "mt-2 text-sm"
              )}
            >
              {description}
            </p>
          ) : null}
          {actions ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-2",
                compact ? "mt-2" : "mt-3"
              )}
            >
              {actions}
            </div>
          ) : null}
          {hasDetails ? (
            <button
              type="button"
              className="mt-2 text-xs font-medium text-indigo-600 hover:underline"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "收起详情" : "展开详情"}
            </button>
          ) : null}
        </div>
      </div>
      {hasDetails && expanded ? (
        <div
          className={cn(
            "border-t border-slate-100 bg-slate-50/80 text-sm text-slate-700",
            compact ? "px-3 py-2" : "px-4 py-3"
          )}
        >
          {details}
        </div>
      ) : null}
    </article>
  );
}
