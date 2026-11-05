"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  ideaId: string;
  ideaTitle: string;
  relatedProjectId: string | null;
  /** 预填验收，默认灵感「下一步」 */
  defaultAcceptance?: string | null;
  compact?: boolean;
};

export function ConvertIdeaToRequirementButton({
  ideaId,
  ideaTitle,
  relatedProjectId,
  defaultAcceptance = null,
  compact = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [acceptance, setAcceptance] = useState(
    () => defaultAcceptance?.trim() || ""
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneHref, setDoneHref] = useState<string | null>(null);

  async function convert() {
    if (!relatedProjectId) {
      setError("请先给灵感关联项目");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/ideas/${ideaId}/to-requirement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptance: acceptance.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "转需求失败");
        return;
      }
      const href =
        (data.poolHref as string | undefined) ||
        `/projects/${relatedProjectId}/tasks`;
      setDoneHref(href);
      setOpen(false);
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setPending(false);
    }
  }

  if (doneHref) {
    return (
      <Link
        href={doneHref}
        className="text-xs font-medium text-emerald-700 hover:underline"
      >
        已入需求池 →
      </Link>
    );
  }

  if (open) {
    return (
      <div className="w-full min-w-[14rem] space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-2">
        <p className="text-[11px] font-medium text-indigo-900">
          写入需求池 · {ideaTitle}
        </p>
        <label className="block space-y-1">
          <span className="text-[11px] text-slate-600">验收标准</span>
          <textarea
            value={acceptance}
            onChange={(e) => setAcceptance(e.target.value)}
            rows={3}
            placeholder="可改；空则用灵感「下一步」/为什么"
            className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-300"
          />
        </label>
        <p className="text-[10px] text-slate-500">
          关联原灵感与项目；不创建 Studio 任务。
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={pending || !relatedProjectId}
            onClick={convert}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? "写入中…" : "确认转入"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
        </div>
        {error ? <span className="block text-xs text-red-600">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!relatedProjectId) {
            setError("请先给灵感关联项目");
            return;
          }
          setError(null);
          setAcceptance(defaultAcceptance?.trim() || "");
          setOpen(true);
        }}
        title={
          relatedProjectId
            ? "写入关联项目的需求池"
            : "需先关联项目"
        }
        className={
          compact
            ? "rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
            : "rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
        }
      >
        转需求
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
