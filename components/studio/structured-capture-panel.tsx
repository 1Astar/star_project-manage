"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StudioBadge } from "@/components/studio/shell";
import {
  EMOTION_LABELS,
  IDEA_SOURCE_OPTIONS,
  type EmotionLevel,
} from "@/lib/studio/types";

const TYPE_OPTIONS = ["产品想法", "UI想法", "技术想法", "内容想法", "作品集想法"] as const;
const STATUS_OPTIONS = ["灵感收件箱", "审阅中", "停车场"] as const;
const EMOTION_OPTIONS = Object.keys(EMOTION_LABELS) as EmotionLevel[];

type LinkOption = { id: string; label: string };

export function StructuredCapturePanel({
  projects,
  defaultProjectId,
}: {
  projects: LinkOption[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [rawThought, setRawThought] = useState("");
  const [summary, setSummary] = useState("");
  const [why, setWhy] = useState("");
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]>("产品想法");
  const [source, setSource] = useState<(typeof IDEA_SOURCE_OPTIONS)[number]>("ChatGPT");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("灵感收件箱");
  const [emotionLevel, setEmotionLevel] = useState<EmotionLevel>("normal");
  const [relatedProjectId, setRelatedProjectId] = useState(defaultProjectId ?? "");
  const [relatedModule, setRelatedModule] = useState("");
  const [suggestedNextStep, setSuggestedNextStep] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) {
      setError("标题必填");
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/studio/ideas/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          rawThought: rawThought.trim(),
          summary: summary.trim(),
          why: why.trim(),
          type,
          source,
          status,
          emotionLevel: EMOTION_LABELS[emotionLevel],
          relatedProjectId: relatedProjectId || null,
          relatedModule: relatedModule.trim(),
          suggestedNextStep: suggestedNextStep.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "提交失败");
      setMessage(`已创建 Issue #${data.issueNumber}，请点击「同步 GitHub 灵感」拉取到收件箱`);
      setTitle("");
      setRawThought("");
      setSummary("");
      setWhy("");
      setRelatedModule("");
      setSuggestedNextStep("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
      >
        + {defaultProjectId ? "记一条灵感" : "粘贴 ChatGPT 结构化灵感"}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-stone-800">AI Capture 模板</div>
          <p className="mt-1 text-xs text-stone-500">
            粘贴 ChatGPT 整理好的字段，经 GitHub Issue 中转后同步进收件箱（不直接写库）
          </p>
        </div>
        <button type="button" className="text-xs text-stone-400 hover:text-stone-600" onClick={() => setOpen(false)}>
          收起
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-sm md:col-span-2">
          <span className="text-stone-500">标题</span>
          <input
            className="mt-1 w-full rounded border border-stone-200 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="AI 共读搭子"
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="text-stone-500">原始想法</span>
          <textarea
            className="mt-1 w-full rounded border border-stone-200 px-3 py-2 text-sm"
            rows={3}
            value={rawThought}
            onChange={(e) => setRawThought(e.target.value)}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="text-stone-500">自动摘要</span>
          <input
            className="mt-1 w-full rounded border border-stone-200 px-3 py-2 text-sm"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="text-stone-500">为什么想做</span>
          <textarea
            className="mt-1 w-full rounded border border-stone-200 px-3 py-2 text-sm"
            rows={2}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-stone-500">类型</span>
          <select className="mt-1 w-full rounded border border-stone-200 px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {TYPE_OPTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-stone-500">来源</span>
          <select className="mt-1 w-full rounded border border-stone-200 px-3 py-2 text-sm" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
            {IDEA_SOURCE_OPTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-stone-500">建议状态</span>
          <select className="mt-1 w-full rounded border border-stone-200 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-stone-500">情绪强度</span>
          <select
            className="mt-1 w-full rounded border border-stone-200 px-3 py-2 text-sm"
            value={emotionLevel}
            onChange={(e) => setEmotionLevel(e.target.value as EmotionLevel)}
          >
            {EMOTION_OPTIONS.map((item) => (
              <option key={item} value={item}>{EMOTION_LABELS[item]}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="text-stone-500">可能关联项目</span>
          <select
            className="mt-1 w-full rounded border border-stone-200 px-3 py-2 text-sm"
            value={relatedProjectId}
            onChange={(e) => setRelatedProjectId(e.target.value)}
          >
            <option value="">暂不关联</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="text-stone-500">关联板块（可选）</span>
          <input
            className="mt-1 w-full rounded border border-stone-200 px-3 py-2 text-sm"
            value={relatedModule}
            onChange={(e) => setRelatedModule(e.target.value)}
            placeholder="如：迭代记录、资源中心、工作台"
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="text-stone-500">下一步建议</span>
          <input
            className="mt-1 w-full rounded border border-stone-200 px-3 py-2 text-sm"
            value={suggestedNextStep}
            onChange={(e) => setSuggestedNextStep(e.target.value)}
          />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {message ? (
        <p className="mt-3 text-sm text-green-700">
          {message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "提交中…" : "提交到 GitHub Issue"}
        </button>
        <StudioBadge tone="muted">外部 ChatGPT 请调 POST /api/ideas/capture</StudioBadge>
      </div>
    </div>
  );
}
