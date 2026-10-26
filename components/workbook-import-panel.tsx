"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  BundleCommitResult,
  BundleConflictItem,
  BundlePreview,
} from "@/lib/excel/workbook-client";
import { WorkbookGridPanel } from "@/components/workbook-grid-panel";

const KIND_LABEL: Record<string, string> = {
  learning: "学习",
  competitor: "竞品",
  requirement: "需求",
  bug: "Bug",
  optimization: "优化",
};

export function WorkbookImportPanel({
  projectSlug,
  compact = false,
}: {
  projectSlug: string;
  /** 嵌在各 Tab 顶部时用紧凑样式 */
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<BundlePreview | null>(null);
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BundleCommitResult | null>(null);

  const updates = useMemo(
    () => (preview?.conflicts ?? []).filter((c) => c.action === "update"),
    [preview]
  );
  const creates = useMemo(
    () => (preview?.conflicts ?? []).filter((c) => c.action === "create"),
    [preview]
  );
  const selectedUpdateCount = updates.filter((c) => c.selected).length;

  function patchConflicts(
    next: (items: BundleConflictItem[]) => BundleConflictItem[]
  ) {
    setPreview((prev) => {
      if (!prev?.conflicts) return prev;
      return { ...prev, conflicts: next(prev.conflicts) };
    });
  }

  function setAllUpdatesSelected(selected: boolean) {
    patchConflicts((items) =>
      items.map((c) =>
        c.action === "update" ? { ...c, selected } : c
      )
    );
  }

  function toggleConflict(key: string) {
    patchConflicts((items) =>
      items.map((c) =>
        c.key === key ? { ...c, selected: !c.selected } : c
      )
    );
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setFileBlob(file);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(
          `/api/projects/${projectSlug}/workbook/preview`,
          { method: "POST", body: formData }
        );
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { preview: BundlePreview };
        setPreview(data.preview);
      } catch (err) {
        setError(err instanceof Error ? err.message : "解析失败");
        setPreview(null);
      }
    });
  }

  function commit() {
    if (!fileBlob || !preview) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", fileBlob);
        formData.append("preview", JSON.stringify(preview));
        const res = await fetch(
          `/api/projects/${projectSlug}/workbook/commit`,
          { method: "POST", body: formData }
        );
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { result: BundleCommitResult };
        setResult(data.result);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "写入失败");
      }
    });
  }

  return (
    <section
      className={
        compact
          ? "rounded-xl border border-slate-200 bg-white p-4"
          : "card p-5"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            总表 Excel 导入
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            多 Sheet：知识表/学习、Bug表、优化表、竞品、需求。知识支持板块→主题→子知识点；优化表写入
            Bug「优化建议」并可一键生成需求；标题相同或内容相似时可勾选是否替换。
          </p>
        </div>
        <a
          href={`/api/projects/${projectSlug}/workbook/template`}
          className="shrink-0 text-xs font-medium text-indigo-600 hover:underline"
        >
          下载模板 ↓
        </a>
      </div>

      <input
        type="file"
        accept=".xlsx,.xls"
        disabled={pending}
        onChange={onFileChange}
        className="mt-3 block w-full text-sm"
      />

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {preview ? (
        <div className="mt-3 space-y-3 text-sm text-slate-700">
          <p>
            预览：新建 {preview.summary.creates ?? creates.length} · 将更新{" "}
            {preview.summary.updates ?? updates.length}
            {preview.summary.embeddedImages
              ? ` · 内嵌图 ${preview.summary.embeddedImages}`
              : ""}
            {preview.summary.linkHints
              ? ` · 关联提示 ${preview.summary.linkHints}`
              : ""}
          </p>
          <ul className="space-y-1 text-xs text-slate-500">
            {preview.sheets.map((s) => (
              <li key={s.sheetName}>
                {s.sheetName}
                {s.ignored
                  ? `（跳过：${s.note ?? ""}）`
                  : ` · ${s.rows.length} 行`}
              </li>
            ))}
          </ul>

          {updates.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    将更新 · 是否替换？
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800/80">
                    含标题相同与内容相似；已勾选 {selectedUpdateCount}/
                    {updates.length}；取消勾选则跳过该条，保留库内原文。
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setAllUpdatesSelected(true)}
                    className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900"
                  >
                    一键全选替换
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setAllUpdatesSelected(false)}
                    className="rounded-lg border border-amber-200 px-2.5 py-1 text-xs text-amber-800"
                  >
                    全部跳过
                  </button>
                </div>
              </div>
              <ul className="mt-3 max-h-56 space-y-1.5 overflow-auto">
                {updates.map((c) => (
                  <li
                    key={c.key}
                    className="flex items-start gap-2 rounded-lg bg-white/80 px-2 py-1.5 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={c.selected}
                      disabled={pending}
                      onChange={() => toggleConflict(c.key)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-slate-800">
                        [{KIND_LABEL[c.kind] ?? c.kind}] {c.title}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        {c.match === "similar"
                          ? `内容相似${
                              c.score != null
                                ? ` ${Math.round(c.score * 100)}%`
                                : ""
                            } · 库内「${c.similarToTitle ?? "?"}」`
                          : "标题相同"}
                        {" · "}来自「{c.sheetName}」
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {creates.length > 0 && updates.length === 0 ? (
            <p className="text-xs text-slate-500">
              全部为新建（{creates.length}），无标题/相似冲突。
            </p>
          ) : null}

          <button
            type="button"
            disabled={pending}
            onClick={commit}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending
              ? "写入中…"
              : updates.length > 0
                ? `确认写入（新建 ${creates.length} · 替换 ${selectedUpdateCount}）`
                : "确认写入"}
          </button>
        </div>
      ) : null}

      {result ? (
        <p className="mt-3 text-sm text-emerald-700">
          已写入：新建 学习{result.created.learning}/优化建议
          {result.created.optimization}/竞品{result.created.competitor}/需求
          {result.created.requirement}/Bug{result.created.bug}；更新 学习
          {result.updated.learning}/优化{result.updated.optimization}/竞品
          {result.updated.competitor}/需求{result.updated.requirement}/Bug
          {result.updated.bug}；关联 {result.linksApplied} 处
          {result.imagesAttached
            ? `；挂图 ${result.imagesAttached}`
            : ""}
          {result.pendingLinks.length
            ? `；未匹配 ${result.pendingLinks.slice(0, 5).join("、")}${
                result.pendingLinks.length > 5 ? "…" : ""
              }`
            : ""}
        </p>
      ) : null}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <WorkbookGridPanel projectSlug={projectSlug} />
      </div>
    </section>
  );
}
