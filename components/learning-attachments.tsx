"use client";

import { useRef, useState, useTransition, type ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { LearningNoteAttachment } from "@/lib/types";
import {
  ImageDropZone,
  asFigureFiles,
  collectImagesFromClipboard,
} from "@/components/image-drop-zone";

function isImageAttachment(a: LearningNoteAttachment): boolean {
  if (a.mime_type?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.title) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.url);
}

export function LearningAttachmentsBlock({
  projectId,
  noteId,
  attachments: initial,
}: {
  projectId: string;
  noteId: string;
  attachments: LearningNoteAttachment[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [attachments, setAttachments] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function uploadMany(files: File[]) {
    if (!files.length) return;
    setError(null);
    const named = asFigureFiles(files, attachments.filter(isImageAttachment).length + 1);
    startTransition(async () => {
      const added: LearningNoteAttachment[] = [];
      for (const file of named) {
        const form = new FormData();
        form.set("projectId", projectId);
        form.set("noteId", noteId);
        form.set("title", file.name);
        form.set("file", file);
        const res = await fetch("/api/projects/learning-attachments", {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "上传失败");
          break;
        }
        added.push(data.attachment as LearningNoteAttachment);
      }
      if (added.length) {
        setAttachments((prev) => [...added, ...prev]);
        router.refresh();
      }
    });
  }

  function uploadFiles(files: File[]) {
    if (!files.length) return;
    setError(null);
    startTransition(async () => {
      const added: LearningNoteAttachment[] = [];
      for (const file of files) {
        const form = new FormData();
        form.set("projectId", projectId);
        form.set("noteId", noteId);
        form.set("title", file.name);
        form.set("file", file);
        const res = await fetch("/api/projects/learning-attachments", {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "上传失败");
          break;
        }
        added.push(data.attachment as LearningNoteAttachment);
      }
      if (added.length) {
        setAttachments((prev) => [...added, ...prev]);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/projects/learning-attachments?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "删除失败");
        return;
      }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
    });
  }

  function handleEditorPaste(e: ClipboardEvent) {
    if (pending) return;
    const images = collectImagesFromClipboard(e.clipboardData);
    if (!images.length) return;
    e.preventDefault();
    uploadMany(images);
  }

  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((a) => !isImageAttachment(a));

  return (
    <section
      className="space-y-2 border-t border-slate-100 pt-3"
      onPaste={handleEditorPaste}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-slate-500">截图 / 附件</h4>
        <button
          type="button"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
        >
          上传文件
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          disabled={pending}
          onChange={(e) => {
            uploadFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      <ImageDropZone
        multiple
        disabled={pending}
        onFiles={uploadMany}
        onUriOnlyDrop={() =>
          setError(
            "拖进来的是链接，读不到真图。请复制图片后 Ctrl+V，或点虚线框选文件。"
          )
        }
        className="py-3 text-center"
      >
        {pending
          ? "上传中…"
          : "拖拽截图到这里，或点击选择；也可在本区 Ctrl+V 粘贴（可多张）"}
      </ImageDropZone>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}

      {images.length === 0 && files.length === 0 ? (
        <p className="text-xs text-slate-400">还没有截图或附件。</p>
      ) : null}

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((a, index) => (
            <div key={a.id} className="overflow-hidden rounded-lg border border-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={a.url} target="_blank" rel="noreferrer">
                <img src={a.url} alt={a.title} className="h-28 w-full object-cover" />
              </a>
              <div className="flex items-center justify-between gap-1 px-2 py-1 text-[11px] text-slate-500">
                <span className="truncate">
                  图{index + 1} · {a.title}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(a.id)}
                  className="shrink-0 text-rose-600"
                >
                  删
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="space-y-1.5">
          {files.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
            >
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-indigo-700 hover:underline"
              >
                {a.title}
              </a>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(a.id)}
                className="shrink-0 text-xs text-rose-600"
              >
                删
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
