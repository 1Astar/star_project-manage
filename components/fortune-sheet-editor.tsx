"use client";

import { useEffect, useRef } from "react";
import { Workbook, type WorkbookInstance } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";

type SheetData = Array<Record<string, unknown>>;

/**
 * FortuneSheet 客户端编辑器（须 dynamic(..., { ssr: false })）。
 * 工具栏含字号/对齐/合并/插图等基础能力，对齐飞书表基础档。
 */
export function FortuneSheetEditor({
  data,
  onChange,
  workbookRef,
}: {
  data: SheetData;
  onChange: (data: SheetData) => void;
  workbookRef?: React.MutableRefObject<WorkbookInstance | null>;
}) {
  const localRef = useRef<WorkbookInstance | null>(null);

  useEffect(() => {
    return () => {
      if (workbookRef) workbookRef.current = null;
    };
  }, [workbookRef]);

  return (
    <div className="h-[min(72vh,720px)] min-h-[420px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Workbook
        ref={(inst) => {
          localRef.current = inst;
          if (workbookRef) workbookRef.current = inst;
        }}
        data={data as never}
        lang="zh"
        showToolbar
        showFormulaBar={false}
        showSheetTabs
        allowEdit
        onChange={(next) => onChange(next as SheetData)}
        toolbarItems={[
          "undo",
          "redo",
          "format-painter",
          "clear-format",
          "|",
          "font",
          "font-size",
          "|",
          "bold",
          "italic",
          "strike-through",
          "underline",
          "|",
          "font-color",
          "background",
          "|",
          "border",
          "merge-cell",
          "|",
          "horizontal-align",
          "vertical-align",
          "|",
          "text-wrap",
          "freeze",
          "filter",
          "|",
          "image",
          "link",
          "comment",
          "|",
          "quick-formula",
        ]}
      />
    </div>
  );
}
