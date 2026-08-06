"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { AssetType } from "@/lib/studio/types";
import { ASSET_TYPE_CREATE_OPTIONS, ASSET_TYPE_LABELS } from "@/lib/studio/types";

type AddAssetFormProps = {
  projectId: string;
  defaultAssetType?: AssetType;
};

const ASSET_TYPES = ASSET_TYPE_CREATE_OPTIONS;

export function AddAssetForm({
  projectId,
  defaultAssetType = "material",
}: AddAssetFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [assetType, setAssetType] = useState<AssetType>(defaultAssetType);
  const [takeaway, setTakeaway] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("请填写标题");
      return;
    }

    const file = fileRef.current?.files?.[0];
    setPending(true);
    setError(null);

    try {
      let res: Response;

      if (file && file.size > 0) {
        const form = new FormData();
        form.set("projectId", projectId);
        form.set("title", title.trim());
        form.set("assetType", assetType);
        form.set("takeaway", takeaway.trim());
        form.set("note", note.trim());
        form.set("file", file);
        res = await fetch("/api/studio/assets/upload", { method: "POST", body: form });
      } else {
        res = await fetch("/api/studio/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            projectId,
            url: url.trim(),
            assetType,
            takeaway: takeaway.trim(),
            note: note.trim(),
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "添加失败");
        return;
      }

      setTitle("");
      setUrl("");
      setNote("");
      setAssetType(defaultAssetType);
      setTakeaway("");
      if (fileRef.current) fileRef.current.value = "";
      setOpen(false);
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("link");
            setAssetType(defaultAssetType);
            setOpen(true);
          }}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          + 新增链接
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("upload");
            setOpen(true);
            setAssetType(defaultAssetType === "material" ? "doc" : defaultAssetType);
          }}
          className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
        >
          + 上传文件
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"
    >
      <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
        Skill / MCP 说明可归档为「文档」或「Prompt / Skill」。此处仅给人查阅；Cursor Agent 仍读本机
        skill 路径。支持上传图片或 .md，也可把 Markdown 贴进备注后预览。
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-600 sm:col-span-2">
          标题 <span className="text-red-500">*</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="资料名称，如 SKILL.md / MCP 说明"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-300"
          />
        </label>
        {mode === "link" ? (
          <label className="block text-xs text-slate-600 sm:col-span-2">
            链接（可选；.md 公开链接可预览）
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
              placeholder="https://"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-300"
            />
          </label>
        ) : null}
        <label className="block text-xs text-slate-600 sm:col-span-2">
          {mode === "upload" ? "上传文件（图片或 .md）" : "附件（可选）"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.md,.markdown,text/markdown,text/plain"
            className="mt-1 block w-full text-xs text-slate-600"
          />
        </label>
        <label className="block text-xs text-slate-600 sm:col-span-2">
          Markdown 备注（可选，无文件时也可预览）
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="可粘贴 SKILL.md / MCP 说明正文…"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-indigo-300"
          />
        </label>
        <label className="block text-xs text-slate-600">
          类型
          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as AssetType)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-600 sm:col-span-2">
          可借鉴点
          <input
            value={takeaway}
            onChange={(e) => setTakeaway(e.target.value)}
            placeholder="一句话总结参考价值"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-indigo-300"
          />
        </label>
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
        >
          取消
        </button>
      </div>
    </form>
  );
}
