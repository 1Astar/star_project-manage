"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadOpenAiSettings } from "@/lib/studio/ai/openai-settings";
import type { BugFeedbackDraft, BugFeedbackPreview } from "@/lib/bugs/parse-feedback";
import { matchImagesToDrafts } from "@/lib/bugs/parse-feedback";
import type { OrganizeBugsPreview } from "@/lib/bugs/organize";
import { ImageDropZone } from "@/components/image-drop-zone";
import {
  BUG_SEVERITY_LABELS,
  BUG_TYPE_LABELS,
  type BugSeverity,
  type BugType,
} from "@/lib/types";

const SEVERITIES = [1, 2, 3, 4] as BugSeverity[];
const BUG_TYPES = Object.keys(BUG_TYPE_LABELS) as BugType[];

export function BugImportOrganizePanel({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) {
  const router = useRouter();
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

  function addFiles(list: File[]) {
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      const next = [...prev, ...list.filter((f) => !names.has(f.name))];
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

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setFileMap((prev) => {
      const next: Record<string, string[]> = {};
      for (const [k, names] of Object.entries(prev)) {
        next[k] = names.filter((n) => n !== name);
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "整理失败");
        return;
      }
      const next = data.preview as BugFeedbackPreview;
      setPreview(next);
      if (files.length) {
        setFileMap(matchImagesToDrafts(next.drafts, files.map((f) => f.name)));
      } else {
        setFileMap({});
      }
    } catch {
      setError("网络错误");
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
          粘贴反馈 + 拖入截图 → AI/规则整理成可改清单 → 你确认匹配后再入库
        </p>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      {tab === "import" ? (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="粘贴反馈。多图请写「见图1」「见图2」，或按 bug 顺序附上同样张数的图。"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
          />
          <ImageDropZone multiple disabled={loading} onFiles={addFiles} />
          {files.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {files.map((f) => (
                <div
                  key={f.name}
                  className="relative w-20 overflow-hidden rounded-md border border-slate-200 bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrls[f.name]}
                    alt={f.name}
                    className="h-16 w-full object-cover"
                  />
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
              已选 {files.length} 张。AI 会尽量按「见图N」/文件名挂到对应问题；不对就在下面勾缩略图改配。
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
