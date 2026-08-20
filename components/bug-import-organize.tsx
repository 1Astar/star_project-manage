"use client";

import { useEffect, useMemo, useState, type ClipboardEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { loadOpenAiSettings } from "@/lib/studio/ai/openai-settings";
import type { BugFeedbackDraft, BugFeedbackPreview } from "@/lib/bugs/parse-feedback";
import { matchImagesToDrafts } from "@/lib/bugs/parse-feedback";
import type { OrganizeBugsPreview } from "@/lib/bugs/organize";
import {
  ImageDropZone,
  asFigureFiles,
  collectImagesFromClipboard,
  collectImagesFromDataTransfer,
  dataTransferLooksLikeUriOnly,
} from "@/components/image-drop-zone";
import {
  BUG_SEVERITY_LABELS,
  BUG_TYPE_LABELS,
  type BugSeverity,
  type BugType,
} from "@/lib/types";

const SEVERITIES = [1, 2, 3, 4] as BugSeverity[];
const BUG_TYPES = Object.keys(BUG_TYPE_LABELS) as BugType[];

type BugImportDraftStore = {
  text: string;
  preferAi: boolean;
  tab: "import" | "organize" | null;
  preview: BugFeedbackPreview | null;
  updatedAt: string;
};

function draftStorageKey(projectId: string) {
  return `star-pm:bug-import-draft:v1:${projectId}`;
}

function loadImportDraft(projectId: string): BugImportDraftStore | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BugImportDraftStore>;
    if (typeof parsed.text !== "string") return null;
    return {
      text: parsed.text,
      preferAi: parsed.preferAi !== false,
      tab: parsed.tab === "import" || parsed.tab === "organize" ? parsed.tab : null,
      preview: parsed.preview && Array.isArray(parsed.preview.drafts) ? parsed.preview : null,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    return null;
  }
}

function saveImportDraft(projectId: string, draft: Omit<BugImportDraftStore, "updatedAt">) {
  if (typeof window === "undefined") return;
  try {
    if (!draft.text.trim() && !draft.preview) {
      localStorage.removeItem(draftStorageKey(projectId));
      return;
    }
    const payload: BugImportDraftStore = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(draftStorageKey(projectId), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

function clearImportDraft(projectId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(draftStorageKey(projectId));
  } catch {
    /* ignore */
  }
}

export function BugImportOrganizePanel({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<"import" | "organize" | null>(null);
  const [text, setText] = useState("");
  const [preferAi, setPreferAi] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<BugFeedbackPreview | null>(null);
  const [fileMap, setFileMap] = useState<Record<string, string[]>>({});
  const [orgPreview, setOrgPreview] = useState<OrganizeBugsPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftHint, setDraftHint] = useState<string | null>(null);

  const selectedCount = useMemo(
    () => preview?.drafts.filter((d) => d.selected).length ?? 0,
    [preview]
  );

  const previewUrls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of files) {
      map[f.name] = URL.createObjectURL(f);
    }
    return map;
  }, [files]);

  useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previewUrls]);

  useEffect(() => {
    const saved = loadImportDraft(projectId);
    if (saved) {
      setText(saved.text);
      setPreferAi(saved.preferAi);
      setPreview(saved.preview);
      if (saved.text.trim() || saved.preview) {
        setTab(saved.tab === "organize" ? "import" : saved.tab ?? "import");
        const when = saved.updatedAt
          ? new Date(saved.updatedAt).toLocaleString("zh-CN", { hour12: false })
          : "";
        setDraftHint(
          `已恢复本机草稿${when ? `（${when}）` : ""}。截图不会自动恢复，请重新拖入。`
        );
      }
    }
    setHydrated(true);
  }, [projectId]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      saveImportDraft(projectId, { text, preferAi, tab, preview });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [hydrated, projectId, text, preferAi, tab, preview]);

  function discardDraft() {
    clearImportDraft(projectId);
    setText("");
    setPreview(null);
    setFiles([]);
    setFileMap({});
    setDraftHint(null);
    setMessage("已清空本机草稿");
  }
  function addFiles(list: File[]) {
    if (!list.length) return;
    setError(null);
    setFiles((prev) => {
      const next = asFigureFiles([...prev, ...list], 1);
      if (preview) {
        setFileMap(
          matchImagesToDrafts(
            preview.drafts,
            next.map((f) => f.name)
          )
        );
      }
      return next;
    });
  }

  function warnUriOnlyDrop() {
    setError(
      "拖进来的是链接（如 vscode-file://），浏览器读不到真图。请：① 把图拖到下方虚线框；② 或先复制图片再在正文里 Ctrl+V；③ 或点虚线框选择文件。"
    );
  }

  function handleImportPaste(e: ClipboardEvent) {
    const images = collectImagesFromClipboard(e.clipboardData);
    if (images.length) {
      e.preventDefault();
      addFiles(images);
      setMessage(`已从剪贴板加入 ${images.length} 张截图`);
      return;
    }
    const plain = e.clipboardData.getData("text/plain")?.trim() ?? "";
    if (/^vscode-file:\/\//i.test(plain) || /^file:\/\//i.test(plain)) {
      e.preventDefault();
      warnUriOnlyDrop();
    }
  }

  function handleImportDragOver(e: DragEvent) {
    if ([...e.dataTransfer.types].some((t) => t === "Files" || t === "text/uri-list")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handleImportDrop(e: DragEvent) {
    const images = collectImagesFromDataTransfer(e.dataTransfer);
    if (images.length) {
      e.preventDefault();
      e.stopPropagation();
      addFiles(images);
      setMessage(`已拖入 ${images.length} 张截图`);
      return;
    }
    if (dataTransferLooksLikeUriOnly(e.dataTransfer)) {
      e.preventDefault();
      e.stopPropagation();
      warnUriOnlyDrop();
    }
  }

  function removeFile(name: string) {
    setFiles((prev) => {
      const next = asFigureFiles(
        prev.filter((f) => f.name !== name),
        1
      );
      if (preview) {
        setFileMap(
          matchImagesToDrafts(
            preview.drafts,
            next.map((f) => f.name)
          )
        );
      } else {
        setFileMap({});
      }
      return next;
    });
  }

  function updateDraft(key: string, patch: Partial<BugFeedbackDraft>) {
    setPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        drafts: prev.drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)),
      };
    });
  }

  function toggleFileOnDraft(draftKey: string, fileName: string) {
    setFileMap((prev) => {
      const cur = new Set(prev[draftKey] ?? []);
      if (cur.has(fileName)) cur.delete(fileName);
      else cur.add(fileName);
      return { ...prev, [draftKey]: [...cur] };
    });
  }

  async function runImportPreview() {
    if (!text.trim()) {
      setError("请粘贴反馈正文");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const ai = loadOpenAiSettings();
      if (preferAi && !ai?.apiKey?.trim()) {
        setError("已勾选「优先用 AI」，但本机未配置 API Key。请到设置里保存，或取消勾选改用规则拆分。");
        return;
      }
      const res = await fetch(`/api/projects/${projectSlug}/bugs/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "preview",
          text,
          preferAi,
          imageFileNames: files.map((f) => f.name),
          openAiApiKey: preferAi ? ai?.apiKey : undefined,
          openAiModel: preferAi ? ai?.model : undefined,
          openAiBaseUrl: preferAi ? ai?.baseUrl : undefined,
        }),
      });
      const rawText = await res.text();
      let data: {
        error?: string;
        preview?: BugFeedbackPreview;
        aiError?: string;
      } = {};
      try {
        data = rawText ? (JSON.parse(rawText) as typeof data) : {};
      } catch {
        setError(
          `整理失败：服务返回非 JSON（HTTP ${res.status}）。可能是 Worker 超时或网关错误，可取消 AI 勾选再试。`
        );
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `整理失败（HTTP ${res.status}）`);
        return;
      }
      const next = data.preview as BugFeedbackPreview;
      if (!next?.drafts) {
        setError("整理失败：返回结果为空");
        return;
      }
      setPreview(next);
      if (files.length) {
        setFileMap(matchImagesToDrafts(next.drafts, files.map((f) => f.name)));
      } else {
        setFileMap({});
      }
      if (next.aiError) {
        setMessage(`AI 未成功（${next.aiError}），已用规则拆分，请核对清单`);
      } else if (next.method === "openai") {
        setMessage("AI 整理完成，请核对后再入库");
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? `网络错误：${e.message}`
          : "网络错误：请求未完成（可能超时）。可取消「优先用 AI」后重试。"
      );
    } finally {
      setLoading(false);
    }
  }

  async function commitImport() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/bugs/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "commit",
          items: preview.drafts,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "入库失败");
        return;
      }
      const bugs = (data.bugs ?? []) as Array<{ id: string; title: string }>;
      const selectedDrafts = preview.drafts.filter((d) => d.selected && d.title.trim());
      let uploaded = 0;
      for (let i = 0; i < bugs.length; i++) {
        const bug = bugs[i];
        const draft = selectedDrafts[i];
        const names = draft ? fileMap[draft.key] ?? [] : [];
        for (const name of names) {
          const file = files.find((f) => f.name === name);
          if (!file) continue;
          const form = new FormData();
          form.set("projectId", projectId);
          form.set("bugId", bug.id);
          form.set("title", file.name);
          form.set("file", file);
          const up = await fetch("/api/projects/bug-attachments", {
            method: "POST",
            body: form,
          });
          if (up.ok) uploaded += 1;
        }
      }
      setMessage(`已导入 ${bugs.length} 条 Bug` + (uploaded ? `，上传 ${uploaded} 张图` : ""));
      setPreview(null);
      setText("");
      setFiles([]);
      setFileMap({});
      clearImportDraft(projectId);
      setDraftHint(null);
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  async function runOrganize(mode: "preview" | "commit") {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/bugs/organize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "整理失败");
        return;
      }
      setOrgPreview(data.preview as OrganizeBugsPreview);
      if (mode === "commit") {
        const r = data.result as {
          fillTypes?: number;
          linkRequirements?: number;
          closedDuplicates?: number;
        };
        setMessage(
          `整理完成：补类型 ${r.fillTypes ?? 0} · 挂需求 ${r.linkRequirements ?? 0} · 关重复 ${r.closedDuplicates ?? 0}`
        );
        router.refresh();
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab((t) => (t === "import" ? null : "import"))}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "import" ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-700"
          }`}
        >
          导入反馈
        </button>
        <button
          type="button"
          onClick={() => {
            setTab((t) => (t === "organize" ? null : "organize"));
            if (tab !== "organize") void runOrganize("preview");
          }}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "organize" ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-700"
          }`}
        >
          整理现有
        </button>
        <p className="text-xs text-slate-500">
          粘贴反馈 + 拖入截图 → AI/规则整理成可改清单 → 你确认匹配后再入库。正文会自动保存在本机。
        </p>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {draftHint ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-amber-700">
          <span>{draftHint}</span>
          <button
            type="button"
            onClick={discardDraft}
            className="rounded border border-amber-200 px-2 py-0.5 text-amber-800 hover:bg-amber-50"
          >
            清空草稿
          </button>
        </div>
      ) : null}

      {tab === "import" ? (
        <div
          className="space-y-3"
          onPaste={handleImportPaste}
          onDragOver={handleImportDragOver}
          onDrop={handleImportDrop}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={handleImportPaste}
            onDragOver={handleImportDragOver}
            onDrop={handleImportDrop}
            rows={8}
            placeholder="粘贴反馈文字（会自动保存在本机，关页不丢）。截图请 Ctrl+V 或拖到下方虚线框。多图可写「见图1」。"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
          />
          {text.trim() || preview ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span>正文已自动保存在本机（按项目分开）</span>
              <button
                type="button"
                onClick={discardDraft}
                className="text-rose-600 underline-offset-2 hover:underline"
              >
                清空草稿
              </button>
            </div>
          ) : null}
          <ImageDropZone
            multiple
            disabled={loading}
            onFiles={addFiles}
            onUriOnlyDrop={warnUriOnlyDrop}
            className="py-4 text-center"
          >
            {loading
              ? "处理中…"
              : "把截图拖到这里 / 点击选择 / 或在上方正文里 Ctrl+V 粘贴剪贴板截图"}
          </ImageDropZone>
          {files.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="relative w-20 overflow-hidden rounded-md border border-slate-200 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrls[f.name]}
                    alt={f.name}
                    className="h-16 w-full object-cover"
                  />
                  <span className="absolute left-0.5 top-0.5 rounded bg-indigo-600 px-1 text-[10px] font-medium text-white">
                    图{i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(f.name)}
                    className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] text-white"
                  >
                    ×
                  </button>
                  <p className="truncate px-1 py-0.5 text-[10px] text-slate-500">{f.name}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-1.5 text-slate-600">
              <input
                type="checkbox"
                checked={preferAi}
                onChange={(e) => setPreferAi(e.target.checked)}
              />
              优先用 AI 整理（需在设置里配过 OpenAI）
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={() => void runImportPreview()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50"
            >
              {loading ? "整理中…" : "整理成清单"}
            </button>
            {preview ? (
              <button
                type="button"
                disabled={loading || selectedCount === 0}
                onClick={() => void commitImport()}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-50"
              >
                确认入库 {selectedCount} 条
              </button>
            ) : null}
          </div>
          {files.length > 0 ? (
            <p className="text-xs text-slate-500">
              已选 {files.length} 张，已自动编号为 图1…图{files.length}。正文写「见图1」即可对上；不对就在下面勾缩略图改配。
            </p>
          ) : null}
          {preview ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                {preview.summary} · {preview.method === "openai" ? "AI" : "规则"}拆分 · 请核对后再入库
              </p>
              {preview.drafts.map((d) => (
                <div
                  key={d.key}
                  className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={d.selected}
                      onChange={(e) => updateDraft(d.key, { selected: e.target.checked })}
                    />
                    <input
                      value={d.title}
                      onChange={(e) => updateDraft(d.key, { title: e.target.value })}
                      className="min-w-[12rem] flex-1 rounded border border-slate-200 px-2 py-1 text-sm font-medium"
                    />
                    <select
                      value={d.severity}
                      onChange={(e) =>
                        updateDraft(d.key, { severity: Number(e.target.value) as BugSeverity })
                      }
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {BUG_SEVERITY_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <select
                      value={d.bugType}
                      onChange={(e) => updateDraft(d.key, { bugType: e.target.value as BugType })}
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                    >
                      {BUG_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {BUG_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={d.reproSteps}
                    onChange={(e) => updateDraft(d.key, { reproSteps: e.target.value })}
                    rows={2}
                    placeholder="重现步骤"
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                  <textarea
                    value={d.description}
                    onChange={(e) => updateDraft(d.key, { description: e.target.value })}
                    rows={2}
                    placeholder="描述 / 期望"
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                  {files.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {files.map((f) => {
                        const on = (fileMap[d.key] ?? []).includes(f.name);
                        return (
                          <button
                            key={f.name}
                            type="button"
                            onClick={() => toggleFileOnDraft(d.key, f.name)}
                            className={`w-20 overflow-hidden rounded-md border text-left ${
                              on
                                ? "border-indigo-500 ring-2 ring-indigo-200"
                                : "border-slate-200 opacity-70"
                            }`}
                            title={f.name}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewUrls[f.name]}
                              alt={f.name}
                              className="h-14 w-full object-cover"
                            />
                            <span className="block truncate px-1 py-0.5 text-[10px] text-slate-600">
                              {on ? "✓ " : ""}
                              {f.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "organize" ? (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void runOrganize("preview")}
              className="rounded-lg border border-slate-200 px-3 py-1.5"
            >
              刷新预览
            </button>
            <button
              type="button"
              disabled={loading || !orgPreview}
              onClick={() => void runOrganize("commit")}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white disabled:opacity-50"
            >
              应用整理
            </button>
          </div>
          {!orgPreview ? (
            <p className="text-xs text-slate-400">加载中…</p>
          ) : (
            <div className="space-y-2 text-xs text-slate-600">
              <p>
                补类型 {orgPreview.fillTypes.length} · 挂需求{" "}
                {orgPreview.linkRequirements.length} · 重复组{" "}
                {orgPreview.duplicateGroups.length}
              </p>
              {orgPreview.fillTypes.slice(0, 12).map((r) => (
                <div key={r.bugId}>
                  「{r.title}」{BUG_TYPE_LABELS[r.from]} → {BUG_TYPE_LABELS[r.to]}
                </div>
              ))}
              {orgPreview.linkRequirements.slice(0, 12).map((r) => (
                <div key={r.bugId}>
                  「{r.title}」→ 需求「{r.requirementTitle}」
                </div>
              ))}
              {orgPreview.duplicateGroups.slice(0, 12).map((g) => (
                <div key={g.keepId}>
                  保留「{g.keepTitle}」，关闭 {g.closeTitles.join("、")}
                </div>
              ))}
              {orgPreview.fillTypes.length +
                orgPreview.linkRequirements.length +
                orgPreview.duplicateGroups.length ===
              0 ? (
                <p className="text-slate-400">暂无可整理项</p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
