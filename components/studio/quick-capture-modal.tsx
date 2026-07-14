"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OpenAiSettingsPanel } from "@/components/studio/openai-settings-panel";
import { StudioBadge } from "@/components/studio/shell";
import { loadOpenAiSettings } from "@/lib/studio/ai/openai-settings";
import {
  EMOTION_LABELS,
  IDEA_TYPE_LABELS,
  type EmotionLevel,
  type IdeaPriority,
  type IdeaSubtask,
  type IdeaType,
} from "@/lib/studio/types";

type LinkOption = { id: string; label: string };

type ScoreBlock = { score: number; summary: string };

type AnalysisPayload = {
  title: string;
  oneLineIdea: string;
  whyItMatters: string;
  type: IdeaType;
  emotionLevel: EmotionLevel;
  priority: IdeaPriority;
  triggerSource: string;
  suggestedAction: "inbox" | "park";
  reasoning: string;
  feasibility: ScoreBlock;
  competitiveness: ScoreBlock;
  subtasks: IdeaSubtask[];
};

type QuickCaptureModalProps = {
  projects: LinkOption[];
};

const PRIORITY_OPTIONS: IdeaPriority[] = ["P0", "P1", "P2", "P3"];
const TYPE_OPTIONS = Object.keys(IDEA_TYPE_LABELS) as IdeaType[];
const EMOTION_OPTIONS = Object.keys(EMOTION_LABELS) as EmotionLevel[];

function priorityTone(priority: IdeaPriority) {
  if (priority === "P0") return "p0" as const;
  if (priority === "P1") return "p1" as const;
  return "default" as const;
}

function scoreTone(score: number) {
  if (score >= 4) return "success" as const;
  if (score <= 2) return "warning" as const;
  return "default" as const;
}

export function QuickCaptureModal({ projects }: QuickCaptureModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rawThought, setRawThought] = useState("");
  const [whyThought, setWhyThought] = useState("");
  const [relatedProjectId, setRelatedProjectId] = useState("");
  const [emotionLevel, setEmotionLevel] = useState<EmotionLevel>("normal");
  const [preferPark, setPreferPark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AnalysisPayload | null>(null);
  const [syncToProject, setSyncToProject] = useState(true);
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    setSettingsReady(!!loadOpenAiSettings());
  }, [open]);

  function resetForm() {
    setRawThought("");
    setWhyThought("");
    setRelatedProjectId("");
    setEmotionLevel("normal");
    setPreferPark(false);
    setDraft(null);
    setError(null);
    setSyncToProject(true);
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  async function analyzeIdea() {
    const text = rawThought.trim();
    if (!text) {
      setError("先写下原始想法");
      return;
    }

    const aiSettings = loadOpenAiSettings();
    if (!aiSettings) {
      setError("请先在弹窗内配置 OpenAI API Key");
      return;
    }

    setLoading(true);
    setError(null);
    setDraft(null);

    try {
      const res = await fetch("/api/studio/ideas/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawInput: text,
          whyThought: whyThought.trim() || undefined,
          emotionLevel,
          preferPark,
          relatedProjectId: relatedProjectId || null,
          openAiApiKey: aiSettings.apiKey,
          openAiModel: aiSettings.model,
          openAiBaseUrl: aiSettings.baseUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "AI 评估失败");
        return;
      }

      const analysis = data.analysis as AnalysisPayload;
      setDraft({
        ...analysis,
        suggestedAction: preferPark ? "park" : analysis.suggestedAction,
        emotionLevel: analysis.emotionLevel ?? emotionLevel,
      });
      setSyncToProject(!!relatedProjectId);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function saveIdea() {
    if (!draft) return;

    setSaving(true);
    setError(null);

    const rawInput = [rawThought.trim(), whyThought.trim() ? `\n\n为什么：${whyThought.trim()}` : ""]
      .join("")
      .trim();

    try {
      const res = await fetch("/api/studio/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          oneLineIdea: draft.oneLineIdea,
          whyItMatters: draft.whyItMatters || whyThought.trim(),
          triggerSource: "手动快速捕捉",
          emotionLevel: draft.emotionLevel,
          type: draft.type,
          priority: draft.priority,
          rawInput,
          subtasks: draft.subtasks,
          status: draft.suggestedAction === "park" ? "parked" : "inbox",
          relatedProjectId: relatedProjectId || null,
          syncSubtasksToProject: !!relatedProjectId && syncToProject,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存失败");
        return;
      }

      closeModal();
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  function updateSubtask(index: number, patch: Partial<IdeaSubtask>) {
    if (!draft) return;
    setDraft({
      ...draft,
      subtasks: draft.subtasks.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sky-300 bg-gradient-to-r from-sky-50 to-indigo-50 px-6 py-5 text-lg font-semibold text-sky-900 shadow-sm transition hover:border-sky-400 hover:from-sky-100 hover:to-indigo-100"
      >
        <span className="text-2xl leading-none">+</span>
        捕捉一个想法
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-capture-title"
            className="w-full max-w-2xl rounded-xl border border-stone-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <div>
                <h2 id="quick-capture-title" className="text-lg font-bold text-stone-900">
                  快速捕捉想法
                </h2>
                <p className="mt-0.5 text-xs text-stone-500">AI 评估实现性 · 竞争力 · 拆解需求任务</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md px-2 py-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              {!draft ? (
                <>
                  <OpenAiSettingsPanel onSaved={() => setSettingsReady(true)} />
                  {!settingsReady ? (
                    <p className="mt-2 text-xs text-amber-700">配置 OpenAI Key 后才能使用 AI 评估。</p>
                  ) : null}

                  <label className="mt-4 block text-xs font-medium text-stone-600">
                    原始想法
                    <textarea
                      value={rawThought}
                      onChange={(e) => setRawThought(e.target.value)}
                      rows={4}
                      placeholder="随便写，越原始越好…"
                      className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
                    />
                  </label>

                  <label className="mt-3 block text-xs font-medium text-stone-600">
                    为什么突然想到
                    <textarea
                      value={whyThought}
                      onChange={(e) => setWhyThought(e.target.value)}
                      rows={2}
                      placeholder="触发场景、痛点、竞品刺激…"
                      className="mt-1 w-full rounded-md border border-stone-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
                    />
                  </label>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-stone-600">
                      关联项目
                      <select
                        value={relatedProjectId}
                        onChange={(e) => setRelatedProjectId(e.target.value)}
                        className="mt-1 w-full rounded-md border border-stone-200 px-2 py-2 text-sm"
                      >
                        <option value="">无（独立灵感）</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-xs font-medium text-stone-600">
                      情绪强度
                      <select
                        value={emotionLevel}
                        onChange={(e) => setEmotionLevel(e.target.value as EmotionLevel)}
                        className="mt-1 w-full rounded-md border border-stone-200 px-2 py-2 text-sm"
                      >
                        {EMOTION_OPTIONS.map((e) => (
                          <option key={e} value={e}>
                            {EMOTION_LABELS[e]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="mt-4 flex items-center gap-2 text-sm text-stone-600">
                    <input
                      type="checkbox"
                      checked={preferPark}
                      onChange={(e) => setPreferPark(e.target.checked)}
                    />
                    先放进停车场（短期不做）
                  </label>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <StudioBadge tone={priorityTone(draft.priority)}>{draft.priority}</StudioBadge>
                    <StudioBadge>{IDEA_TYPE_LABELS[draft.type]}</StudioBadge>
                    <StudioBadge tone={draft.emotionLevel === "excited" ? "warning" : "default"}>
                      {EMOTION_LABELS[draft.emotionLevel]}
                    </StudioBadge>
                    <StudioBadge tone={scoreTone(draft.feasibility.score)}>
                      实现性 {draft.feasibility.score}/5
                    </StudioBadge>
                    <StudioBadge tone={scoreTone(draft.competitiveness.score)}>
                      竞争力 {draft.competitiveness.score}/5
                    </StudioBadge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-stone-100 bg-stone-50 p-3 text-sm">
                      <div className="text-xs font-medium text-stone-500">实现性</div>
                      <p className="mt-1 text-stone-700">{draft.feasibility.summary}</p>
                    </div>
                    <div className="rounded-md border border-stone-100 bg-stone-50 p-3 text-sm">
                      <div className="text-xs font-medium text-stone-500">竞争力</div>
                      <p className="mt-1 text-stone-700">{draft.competitiveness.summary}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-stone-500">{draft.reasoning}</p>

                  <label className="mt-4 block text-xs text-stone-500">
                    标题
                    <input
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
                    />
                  </label>

                  <h3 className="mt-5 text-sm font-semibold text-stone-700">需求任务拆解</h3>
                  <ul className="mt-2 space-y-2">
                    {draft.subtasks.map((subtask, index) => (
                      <li key={index} className="rounded-md border border-stone-100 bg-stone-50 p-3">
                        <div className="flex items-center gap-2">
                          <StudioBadge tone={priorityTone(subtask.priority)}>{subtask.priority}</StudioBadge>
                          <select
                            value={subtask.priority}
                            onChange={(e) =>
                              updateSubtask(index, { priority: e.target.value as IdeaPriority })
                            }
                            className="rounded border border-stone-200 bg-white px-2 py-0.5 text-xs"
                          >
                            {PRIORITY_OPTIONS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          value={subtask.title}
                          onChange={(e) => updateSubtask(index, { title: e.target.value })}
                          className="mt-2 w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-sm"
                        />
                      </li>
                    ))}
                  </ul>

                  {relatedProjectId ? (
                    <label className="mt-4 flex items-center gap-2 text-sm text-stone-600">
                      <input
                        type="checkbox"
                        checked={syncToProject}
                        onChange={(e) => setSyncToProject(e.target.checked)}
                      />
                      同时将任务写入关联项目的需求列表
                    </label>
                  ) : null}
                </>
              )}

              {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
              {!draft ? (
                <>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-md border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={analyzeIdea}
                    disabled={loading || !rawThought.trim()}
                    className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    {loading ? "AI 评估中…" : "AI 评估并拆解"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setDraft(null)}
                    className="rounded-md border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
                  >
                    返回修改
                  </button>
                  <button
                    type="button"
                    onClick={saveIdea}
                    disabled={saving}
                    className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                  >
                    {saving ? "保存中…" : "确认保存"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
