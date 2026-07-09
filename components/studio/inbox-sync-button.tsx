"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InboxSyncButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/studio/ideas/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "同步失败");
      setResult(`同步完成：${data.created} 新建，${data.updated} 更新（共 ${data.total} 条 Issue）`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "同步失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={sync}
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
      >
        {pending ? "同步中…" : "同步 GitHub 灵感"}
      </button>
      {result ? <span className="text-xs text-green-700">{result}</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
