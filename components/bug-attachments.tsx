"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BugAttachment } from "@/lib/types";

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

  function upload(file: File) {
    setError(null);
    startTransition(async () => {
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
        return;
      }
      setAttachments((prev) => [data.attachment as BugAttachment, ...prev]);
      router.refresh();
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
        <label className="cursor-pointer rounded border border-slate-200 px-2 py-0.5 text-[11px] text-indigo-700">
          {pending ? "上传中…" : "+ 上传图片"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={pending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
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
