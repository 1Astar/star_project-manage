"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

export function StudioBackupPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    window.location.href = "/api/studio/backup";
  }

  function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("请选择备份 JSON 文件");
      return;
    }

    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const text = await file.text();
        const payload = JSON.parse(text) as unknown;
        const res = await fetch("/api/studio/backup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "导入失败");
          return;
        }
        setMessage(`已还原（${data.mode === "supabase" ? "Supabase" : "本地内存"}），含图片附件`);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch {
        setError("文件格式无效或网络错误");
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        导出 Studio 全量数据（项目/灵感/任务/资料）及 Supabase 图片为 JSON；在另一台电脑登录后导入即可还原。
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          导出 JSON 备份
        </button>
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
          选择备份文件
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={handleImport}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 disabled:opacity-60"
        >
          {pending ? "导入中…" : "导入并还原"}
        </button>
      </div>
      {message ? <p className="text-sm text-green-600">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
