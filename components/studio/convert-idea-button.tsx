"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IdeaStatus } from "@/lib/studio/types";

type ConvertIdeaButtonProps = {
  ideaId: string;
  ideaTitle: string;
  status: IdeaStatus;
  relatedProjectId: string | null;
};

export function ConvertIdeaButton({
  ideaId,
  ideaTitle,
  status,
  relatedProjectId,
}: ConvertIdeaButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "converted" && relatedProjectId) {
    return (
      <Link
        href={`/projects/${relatedProjectId}`}
        className="text-xs font-medium text-blue-600 hover:underline"
      >
        查看项目 →
      </Link>
    );
  }

  if (status === "archived") {
    return <span className="text-xs text-stone-400">—</span>;
  }

  async function convert() {
    const ok = window.confirm(
      `将「${ideaTitle}」转为新项目？\n\n会自动：创建项目 · 写入初始演进记录 · 标记为已转项目`
    );
    if (!ok) return;

    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/studio/ideas/${ideaId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "转换失败");
        return;
      }

      router.push(`/projects/${data.project.id}`);
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={convert}
        className="rounded-md bg-stone-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
      >
        {pending ? "转换中…" : "转成项目"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
