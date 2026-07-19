"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/studio/idea-stream-utils";

type ProjectOption = { id: string; label: string };

export function StreamQuickCapture({
  projects,
  defaultProjectId,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [occurredLocal, setOccurredLocal] = useState(() => toDatetimeLocalValue(new Date().toISOString()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const title = text.trim();
    if (!title || saving) return;

    setSaving(true);
    setError(null);

    try {
      const occurredAt = fromDatetimeLocalValue(occurredLocal) ?? new Date().toISOString();
      const res = await fetch("/api/studio/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          oneLineIdea: title,
          rawInput: title,
          status: "inbox",
          triggerSource: "手动",
          relatedProjectId: projectId || null,
          occurredAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      setText("");
      setOccurredLocal(toDatetimeLocalValue(new Date().toISOString()));
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:left-56">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="随手记一条灵感，Enter 保存"
          disabled={saving}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <input
          type="datetime-local"
          value={occurredLocal}
          onChange={(e) => setOccurredLocal(e.target.value)}
          title="灵感发生时间"
          disabled={saving}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 sm:w-48"
        />
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 sm:w-40"
        >
          <option value="">未归属</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving || !text.trim()}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "保存中…" : "记录"}
        </button>
      </div>
      {error ? <p className="mx-auto mt-1 max-w-3xl text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
