"use client";

import { useCallback, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from "react";

function pickImageFiles(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(f.name));
}

/** 剪贴板/拖放里的图常叫 image.png，多张会撞名 */
export function uniquifyImageFiles(files: File[]): File[] {
  const stamp = Date.now();
  return files.map((f, i) => {
    const base = f.name?.trim() || "";
    const needsRename =
      !base ||
      /^image\.(png|jpe?g|gif|webp)$/i.test(base) ||
      /^blob$/i.test(base);
    if (!needsRename) return f;
    const ext =
      f.type.includes("jpeg") || f.type.includes("jpg")
        ? "jpg"
        : f.type.includes("webp")
          ? "webp"
          : f.type.includes("gif")
            ? "gif"
            : "png";
    return new File([f], `paste-${stamp}-${i + 1}.${ext}`, {
      type: f.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
    });
  });
}

export function collectImagesFromDataTransfer(dt: DataTransfer | null | undefined): File[] {
  if (!dt) return [];
  const fromFiles = pickImageFiles(dt.files);
  if (fromFiles.length) return uniquifyImageFiles(fromFiles);

  const fromItems: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && (file.type.startsWith("image/") || !file.type)) {
      fromItems.push(file);
    }
  }
  return uniquifyImageFiles(pickImageFiles(fromItems));
}

export function collectImagesFromClipboard(clipboardData: DataTransfer | null | undefined): File[] {
  return collectImagesFromDataTransfer(clipboardData);
}

/** Cursor / VS Code 拖图时常只给 vscode-file:// 文本，浏览器读不到真实文件 */
export function dataTransferLooksLikeUriOnly(dt: DataTransfer | null | undefined): boolean {
  if (!dt) return false;
  if (collectImagesFromDataTransfer(dt).length > 0) return false;
  const uri = dt.getData("text/uri-list") || dt.getData("text/plain") || "";
  return /^(vscode-file:|file:|https?:)/i.test(uri.trim());
}

export function ImageDropZone({
  multiple = false,
  disabled = false,
  onFiles,
  onUriOnlyDrop,
  className = "",
  children,
}: {
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  onUriOnlyDrop?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const take = useCallback(
    (list: FileList | File[] | null | undefined) => {
      const images = uniquifyImageFiles(pickImageFiles(list));
      if (!images.length) return;
      onFiles(multiple ? images : images.slice(0, 1));
    },
    [multiple, onFiles]
  );

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) e.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;
    const images = collectImagesFromDataTransfer(e.dataTransfer);
    if (images.length) {
      onFiles(multiple ? images : images.slice(0, 1));
      return;
    }
    if (dataTransferLooksLikeUriOnly(e.dataTransfer)) {
      onUriOnlyDrop?.();
    }
  }

  function handlePaste(e: ClipboardEvent) {
    if (disabled) return;
    const images = collectImagesFromClipboard(e.clipboardData);
    if (!images.length) return;
    e.preventDefault();
    e.stopPropagation();
    onFiles(multiple ? images : images.slice(0, 1));
  }

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
      onPaste={handlePaste}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
              ? "拖拽多张截图到这里，或点击选择；也可在正文里 Ctrl+V 粘贴截图"
              : "拖拽截图到这里，或点击选择；也可 Ctrl+V 粘贴"}
        </span>
      )}
    </div>
  );
}
