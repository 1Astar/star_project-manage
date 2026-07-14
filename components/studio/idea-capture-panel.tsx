"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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

type LinkMode = "none" | "project" | "idea";

type LinkOption = {
  id: string;
  label: string;
};

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
  subtasks: IdeaSubtask[];
};

type IdeaCapturePanelProps = {
  projects: LinkOption[];
  ideas: LinkOption[];
};

const PRIORITY_OPTIONS: IdeaPriority[] = ["P0", "P1", "P2", "P3"];
const TYPE_OPTIONS = Object.keys(IDEA_TYPE_LABELS) as IdeaType[];
const EMOTION_OPTIONS = Object.keys(EMOTION_LABELS) as EmotionLevel[];

function priorityTone(priority: IdeaPriority) {
  if (priority === "P0") return "p0" as const;
  if (priority === "P1") return "p1" as const;
  return "default" as const;
}

export function IdeaCapturePanel({ projects, ideas }: IdeaCapturePanelProps) {
  const router = useRouter();
  const [rawInput, setRawInput] = useState("");
  const [linkMode, setLinkMode] = useState<LinkMode>("none");
  const [linkId, setLinkId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AnalysisPayload | null>(null);
  const [syncToProject, setSyncToProject] = useState(true);
  const [settingsReady, setSettingsReady] = useState(() => !!loadOpenAiSettings());

  const linkOptions = useMemo(() => {
    if (linkMode === "project") return projects;
    if (linkMode === "idea") return ideas;
    return [];
  }, [ideas, linkMode, projects]);

  async function analyzeIdea() {
    const text = rawInput.trim();
    if (!text) {
      setError("先写下你的灵感");
      return;
    }

    const aiSettings = loadOpenAiSettings();
    if (!aiSettings) {
      setError("请先在下方配置 OpenAI API Key");
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
          relatedProjectId: linkMode === "project" && linkId ? linkId : null,
          relatedIdeaId: linkMode === "idea" && linkId ? linkId : null,
          openAiApiKey: aiSettings.apiKey,
          openAiModel: aiSettings.model,
          openAiBaseUrl: aiSettings.baseUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "AI 拆解失败");
        return;
      }

      setDraft(data.analysis as AnalysisPayload);
      setSyncToProject(linkMode === "project" && !!linkId);
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

    try {
      const res = await fetch("/api/studio/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          oneLineIdea: draft.oneLineIdea,
          whyItMatters: draft.whyItMatters,
          triggerSource: draft.triggerSource,
          emotionLevel: draft.emotionLevel,
          type: draft.type,
          priority: draft.priority,
          rawInput,
          subtasks: draft.subtasks,
          status: draft.suggestedAction === "park" ? "parked" : "inbox",
          relatedProjectId: linkMode === "project" && linkId ? linkId : null,
          relatedIdeaId: linkMode === "idea" && linkId ? linkId : null,
          syncSubtasksToProject: linkMode === "project" && syncToProject,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存失败");
        return;
      }

      setRawInput("");
      setDraft(null);
      setLinkMode("none");
      setLinkId("");
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
    <section className="rounded-lg border border-sky-200 bg-sky-50/40 p-5">
      <h2 className="text-sm font-semibold text-sky-900">发送灵感 · AI 拆解优先级</h2>
      <p className="mt-1 text-xs text-sky-700/80">
        随便写一段话，可选关联项目或已有灵感；AI 会定 P0–P3 并拆出子任务。
      </p>

      <div className="mt-3">
        <OpenAiSettingsPanel onSaved={() => setSettingsReady(true)} />
      </div>

      {!settingsReady ? (
        <p className="mt-2 text-xs text-amber-700">配置 OpenAI Key 后才能使用 AI 拆解。</p>
      ) : null}

      <textarea
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
        rows={4}
        placeholder="例如：想在 AI 宠物专注模式里加呼吸动画，宠物跟着用户节奏缩放，强化陪伴感…"
        className="mt-4 w-full rounded-md border border-sky-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-sky-400"
      />

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs text-stone-600">
          关联到
          <select
            value={linkMode}
            onChange={(e) => {
              const mode = e.target.value as LinkMode;
              setLinkMode(mode);
              setLinkId("");
            }}
            className="ml-2 rounded-md border border-stone-200 bg-white px-2 py-1.5 text-sm"
          >
            <option value="none">无（独立灵感）</option>
            <option value="project">项目</option>
            <option value="idea">已有灵感</option>
          </select>
        </label>

        {linkMode !== "none" ? (
          <label className="min-w-[200px] flex-1 text-xs text-stone-600">
            {linkMode === "project" ? "选择项目" : "选择灵感"}
            <select
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">请选择…</option>
              {linkOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button
          type="button"
          onClick={analyzeIdea}
          disabled={loading || !rawInput.trim()}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? "AI 拆解中…" : "AI 拆解"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {draft ? (
        <div className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StudioBadge tone={priorityTone(draft.priority)}>{draft.priority}</StudioBadge>
            <StudioBadge>{IDEA_TYPE_LABELS[draft.type]}</StudioBadge>
            <StudioBadge tone={draft.emotionLevel === "excited" ? "warning" : "default"}>
              {EMOTION_LABELS[draft.emotionLevel]}
            </StudioBadge>
            <StudioBadge tone={draft.suggestedAction === "park" ? "muted" : "success"}>
              {draft.suggestedAction === "park" ? "建议停车" : "进收件箱"}
            </StudioBadge>
          </div>

          <p className="mt-3 text-xs text-stone-500">{draft.reasoning}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-xs text-stone-500">
              标题
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs text-stone-500">
              优先级
              <select
                value={draft.priority}
                onChange={(e) =>
                  setDraft({ ...draft, priority: e.target.value as IdeaPriority })
                }
                className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-3 block text-xs text-stone-500">
            一句话想法
            <input
              value={draft.oneLineIdea}
              onChange={(e) => setDraft({ ...draft, oneLineIdea: e.target.value })}
              className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
            />
          </label>

          <label className="mt-3 block text-xs text-stone-500">
            为什么重要
            <textarea
              value={draft.whyItMatters}
              onChange={(e) => setDraft({ ...draft, whyItMatters: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
            />
          </label>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block text-xs text-stone-500">
              类型
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as IdeaType })}
                className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {IDEA_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-stone-500">
              情绪
              <select
                value={draft.emotionLevel}
                onChange={(e) =>
                  setDraft({ ...draft, emotionLevel: e.target.value as EmotionLevel })
                }
                className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1.5 text-sm"
              >
                {EMOTION_OPTIONS.map((e) => (
                  <option key={e} value={e}>
                    {EMOTION_LABELS[e]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <h3 className="mt-5 text-sm font-semibold text-stone-700">子任务拆解</h3>
          <ul className="mt-2 space-y-3">
            {draft.subtasks.map((subtask, index) => (
              <li key={index} className="rounded-md border border-stone-100 bg-stone-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
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
                <textarea
                  value={subtask.rationale}
                  onChange={(e) => updateSubtask(index, { rationale: e.target.value })}
                  rows={2}
                  className="mt-2 w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-600"
                />
              </li>
            ))}
          </ul>

          {linkMode === "project" && linkId ? (
            <label className="mt-4 flex items-center gap-2 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={syncToProject}
                onChange={(e) => setSyncToProject(e.target.checked)}
              />
              同时将子任务写入关联项目的任务列表
            </label>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={saveIdea}
              disabled={saving}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {saving ? "保存中…" : "确认保存"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-md border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
