"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  BundleCommitResult,
  BundlePreview,
} from "@/lib/excel/workbook-bundle";
import { WorkbookGridPanel } from "@/components/workbook-grid-panel";

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
            多 Sheet：知识表/学习、Bug表、优化表、竞品、需求。知识表「板块→主题→要点」进学习树；优化挂到对应板块建议；关联列可空。
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
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>
            预览：知识/学习 {preview.summary.learning} · 优化{" "}
            {preview.summary.optimization} · Bug {preview.summary.bug} · 竞品{" "}
            {preview.summary.competitor} · 需求 {preview.summary.requirement}
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
          <button
            type="button"
            disabled={pending}
            onClick={commit}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? "写入中…" : "确认写入"}
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
