"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

function pickImageFiles(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
}

export function ImageDropZone({
  multiple = false,
  disabled = false,
  onFiles,
  className = "",
  children,
}: {
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const take = useCallback(
    (list: FileList | File[] | null | undefined) => {
      const images = pickImageFiles(list);
      if (!images.length) return;
      onFiles(multiple ? images : images.slice(0, 1));
    },
    [multiple, onFiles]
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        if (disabled) return;
        take(e.dataTransfer.files);
      }}
      className={`cursor-pointer rounded-lg border border-dashed px-3 py-2 text-xs transition ${
        dragging
          ? "border-indigo-400 bg-indigo-50 text-indigo-800"
          : "border-slate-200 bg-slate-50/80 text-slate-600 hover:border-indigo-300"
      } ${disabled ? "pointer-events-none opacity-50" : ""} ${className}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
      {children ?? (
        <span>
          {dragging
            ? "松开以上传"
            : multiple
              ? "拖拽多张截图到这里，或点击选择"
              : "拖拽截图到这里，或点击选择"}
        </span>
      )}
    </div>
  );
}
