"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  buildSideBySideDiff,
  htmlToDiffText,
  type DiffSideCell,
} from "@/lib/prds/side-by-side-diff";

function cellBg(kind: DiffSideCell["kind"], side: "left" | "right") {
  if (kind === "spacer") return "bg-slate-50/80";
  if (kind === "equal") return "bg-white";
  if (kind === "del") return "bg-rose-50";
  if (kind === "add") return "bg-emerald-50";
  // change
  return side === "left" ? "bg-rose-50" : "bg-emerald-50";
}

function gutterMark(kind: DiffSideCell["kind"], side: "left" | "right") {
  if (kind === "del" || (kind === "change" && side === "left")) return "−";
  if (kind === "add" || (kind === "change" && side === "right")) return "+";
  return "";
}

function gutterBar(kind: DiffSideCell["kind"], side: "left" | "right") {
  if (kind === "del" || (kind === "change" && side === "left")) {
    return "border-l-2 border-rose-400";
  }
  if (kind === "add" || (kind === "change" && side === "right")) {
    return "border-l-2 border-emerald-500";
  }
  return "border-l-2 border-transparent";
}

function renderSpans(cell: DiffSideCell, side: "left" | "right") {
  if (!cell.spans?.length) {
    return cell.text || "\u00a0";
  }
  return cell.spans.map((s, i) =>
    s.changed ? (
      <mark
        key={i}
        className={
          side === "left"
            ? "rounded-sm bg-rose-300/70 text-inherit"
            : "rounded-sm bg-emerald-300/70 text-inherit"
        }
      >
        {s.text}
      </mark>
    ) : (
      <span key={i}>{s.text}</span>
    )
  );
}

function DiffPane({
  title,
  side,
  rows,
  scrollRef,
  onScroll,
}: {
  title: string;
  side: "left" | "right";
  rows: ReturnType<typeof buildSideBySideDiff>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-slate-200 bg-white">
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
        {title}
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto font-mono text-[12px] leading-[1.55] text-slate-800"
      >
        <table className="w-full border-collapse">
          <tbody>
            {rows.map((row, idx) => {
              const cell = side === "left" ? row.left : row.right;
              return (
                <tr
                  key={`${side}-${idx}`}
                  className={`${cellBg(cell.kind, side)} ${gutterBar(cell.kind, side)}`}
                >
                  <td className="w-8 select-none px-1 text-center text-[11px] text-slate-400">
                    {gutterMark(cell.kind, side)}
                  </td>
                  <td className="w-10 select-none px-1 text-right text-[11px] text-slate-400">
                    {cell.lineNo ?? ""}
                  </td>
                  <td className="whitespace-pre-wrap break-words px-2 py-0.5">
                    {renderSpans(cell, side)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * VS Code 风格左右对照：左=旧版，右=新版；同步滚动；红删绿增 + 字级高亮。
 */
export function PrdSideDiff({
  previousHtml,
  currentHtml,
  previousLabel,
  currentLabel,
}: {
  previousHtml: string;
  currentHtml: string;
  previousLabel: string;
  currentLabel: string;
}) {
  const rows = useMemo(() => {
    const prev = htmlToDiffText(previousHtml);
    const curr = htmlToDiffText(currentHtml);
    return buildSideBySideDiff(prev, curr);
  }, [previousHtml, currentHtml]);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const lock = useRef<"left" | "right" | null>(null);

  useEffect(() => {
    lock.current = null;
  }, [rows]);

  function syncFrom(side: "left" | "right") {
    const src = side === "left" ? leftRef.current : rightRef.current;
    const dst = side === "left" ? rightRef.current : leftRef.current;
    if (!src || !dst) return;
    if (lock.current && lock.current !== side) return;
    lock.current = side;
    dst.scrollTop = src.scrollTop;
    dst.scrollLeft = src.scrollLeft;
    requestAnimationFrame(() => {
      if (lock.current === side) lock.current = null;
    });
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500">
        <span>
          左右对照 · 红=旧版删除/改前 · 绿=新版新增/改后（字级高亮）
        </span>
        <span className="text-slate-400">
          {rows.filter((r) => r.left.kind !== "equal").length} 处差异行
        </span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px bg-slate-200 md:grid-cols-2">
        <DiffPane
          title={`旧 · ${previousLabel}`}
          side="left"
          rows={rows}
          scrollRef={leftRef}
          onScroll={() => syncFrom("left")}
        />
        <DiffPane
          title={`新 · ${currentLabel}`}
          side="right"
          rows={rows}
          scrollRef={rightRef}
          onScroll={() => syncFrom("right")}
        />
      </div>
    </div>
  );
}
