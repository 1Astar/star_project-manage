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
  const [pending, setPending] = useState<"done" | "convert" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status === "done") {
    return (
      <span className="text-xs font-medium text-emerald-600">
        已完成
        {relatedProjectId ? (
          <>
            {" · "}
            <Link href={`/projects/${relatedProjectId}`} className="text-indigo-600 hover:underline">
              看项目
            </Link>
          </>
        ) : null}
      </span>
    );
  }

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

  async function markDone() {
    const ok = window.confirm(
      `将「${ideaTitle}」标为已完成？\n\n不强制拆任务；若已有关联任务可继续单独管理。`
    );
    if (!ok) return;

    setPending("done");
    setError(null);
    try {
      const res = await fetch(`/api/studio/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "标记失败");
        return;
      }
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setPending(null);
    }
  }

  async function convert() {
    const ok = window.confirm(
      `将「${ideaTitle}」转为新项目？\n\n会自动：创建项目（定位/优先级/下一步）· 同步子任务 · 写入初始演进 · 标记已转项目`
    );
    if (!ok) return;

    setPending("convert");
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
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={!!pending}
          onClick={markDone}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          {pending === "done" ? "处理中…" : "标为完成"}
        </button>
        <button
          type="button"
          disabled={!!pending}
          onClick={convert}
          className="rounded-md bg-stone-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {pending === "convert" ? "转换中…" : "转成项目"}
        </button>
      </div>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
