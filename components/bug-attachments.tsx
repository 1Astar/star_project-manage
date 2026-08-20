"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BugAttachment } from "@/lib/types";
import { ImageDropZone } from "@/components/image-drop-zone";

export function BugAttachmentsBlock({
  projectId,
  bugId,
  attachments: initial,
}: {
  projectId: string;
  bugId: string;
  attachments: BugAttachment[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [attachments, setAttachments] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function uploadMany(files: File[]) {
    if (!files.length) return;
    setError(null);
    startTransition(async () => {
      const added: BugAttachment[] = [];
      for (const file of files) {
        const form = new FormData();
        form.set("projectId", projectId);
        form.set("bugId", bugId);
        form.set("title", file.name);
        form.set("file", file);
        const res = await fetch("/api/projects/bug-attachments", {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "上传失败");
          break;
        }
        added.push(data.attachment as BugAttachment);
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
      const res = await fetch(`/api/projects/bug-attachments?id=${id}`, {
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

  return (
    <section className="space-y-2 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-slate-500">截图 / 附件</h4>
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
        {pending ? "上传中…" : "拖拽截图到这里，或点击选择；也可点此框后 Ctrl+V 粘贴（可多张）"}
      </ImageDropZone>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {attachments.length === 0 ? (
        <p className="text-xs text-slate-400">还没有截图。导入反馈或这里上传。</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {attachments.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-lg border border-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={a.url} target="_blank" rel="noreferrer">
                <img src={a.url} alt={a.title} className="h-28 w-full object-cover" />
              </a>
              <div className="flex items-center justify-between gap-1 px-2 py-1 text-[11px] text-slate-500">
                <span className="truncate">{a.title}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(a.id)}
                  className="text-rose-600"
                >
                  删
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
