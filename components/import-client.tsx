"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ParsePreview } from "@/lib/excel/parser";
import type { NotionCsvPreview } from "@/lib/notion/parser";

type ImportTab = "excel" | "notion";

export function ImportClient({
  projectSlug,
  projectId,
}: {
  projectSlug: string;
  projectId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<ImportTab>("excel");
  const [preview, setPreview] = useState<ParsePreview[] | null>(null);
  const [notionPreview, setNotionPreview] = useState<NotionCsvPreview | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [clearExisting, setClearExisting] = useState(false);
  const [clearPool, setClearPool] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);

  function resetState() {
    setError(null);
    setResult(null);
    setPreview(null);
    setNotionPreview(null);
    setSelectedSheet("");
  }

  function onExcelFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    resetState();
    setFileBlob(file);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/projects/${projectSlug}/import/preview`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { previews: ParsePreview[] };
        setPreview(data.previews);
        setSelectedSheet(data.previews[0]?.sheetName ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "导入失败");
      }
    });
  }

  function onNotionFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    resetState();
    setFileBlob(file);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/projects/${projectSlug}/import/notion/preview`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { preview: NotionCsvPreview };
        setNotionPreview(data.preview);
      } catch (err) {
        setError(err instanceof Error ? err.message : "解析失败");
      }
    });
  }

  function commitExcelImport() {
    if (!fileBlob || !selectedSheet) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", fileBlob);
        formData.append("sheetName", selectedSheet);
        formData.append("clearExisting", String(clearExisting));
        const res = await fetch(`/api/projects/${projectSlug}/import/commit`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as {
          result: {
            requirementsCreated: number;
            tasksCreated: number;
            totalEstimateHours: number;
          };
          sheetName: string;
        };
        setResult(
          `已导入 ${data.sheetName}：${data.result.requirementsCreated} 条需求，${data.result.tasksCreated} 个任务，合计 ${data.result.totalEstimateHours}h`
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "写入失败");
      }
    });
  }

  function commitNotionImport() {
    if (!fileBlob) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", fileBlob);
        formData.append("clearPool", String(clearPool));
        const res = await fetch(`/api/projects/${projectSlug}/import/notion/commit`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as {
          result: { requirementsCreated: number; modulesCreated: number };
        };
        setResult(
          `已导入需求池：${data.result.requirementsCreated} 条功能点，${data.result.modulesCreated} 个模块`
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "写入失败");
      }
    });
  }

  const activeSheet = preview?.find((p) => p.sheetName === selectedSheet);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setTab("excel");
            resetState();
            setFileBlob(null);
          }}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${
            tab === "excel"
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-slate-200 text-slate-600"
          }`}
        >
          Excel 工时表
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("notion");
            resetState();
            setFileBlob(null);
          }}
          className={`rounded-lg border px-4 py-2 text-sm font-medium ${
            tab === "notion"
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-slate-200 text-slate-600"
          }`}
        >
          Notion CSV → 需求池
        </button>
      </div>

      {tab === "excel" ? (
        <section className="card p-5">
          <h2 className="font-semibold">上传 Excel 工时表</h2>
          <p className="mt-1 text-sm text-slate-500">
            自动识别合并表头、层级继承、重复岗位列与混合格式日期。确认预览后写入迭代需求看板。
          </p>
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={pending}
            onChange={onExcelFileChange}
            className="mt-4 block w-full text-sm"
          />
          <a
            href={`/api/projects/${projectSlug}/export`}
            className="mt-4 inline-block text-sm text-blue-600"
          >
            导出当前项目为 Excel ↓
          </a>
        </section>
      ) : (
        <section className="card p-5">
          <h2 className="font-semibold">上传 Notion 导出的 CSV</h2>
          <p className="mt-1 text-sm text-slate-500">
            在 Notion 数据库右上角「…」→ 导出 → CSV。支持：功能点、产品模块、功能细分、分类、阶段、状态、优先级、优化方向、存在问题、难点、场景、需求提出时间、截止日期、需讨论。
            导入后进入
            <a href={`/projects/${projectSlug}/pool`} className="mx-1 text-blue-600">
              需求池
            </a>
            （仅产品可见）。
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={pending}
            onChange={onNotionFileChange}
            className="mt-4 block w-full text-sm"
          />
        </section>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {result ? <p className="text-sm text-green-600">{result}</p> : null}

      {tab === "excel" && preview && preview.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {preview.map((s) => (
            <button
              key={s.sheetName}
              type="button"
              onClick={() => setSelectedSheet(s.sheetName)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                selectedSheet === s.sheetName
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200"
              }`}
            >
              {s.sheetName}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "excel" && activeSheet ? (
        <section className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="font-semibold">{activeSheet.sheetName}</div>
            <div className="text-sm text-slate-500">
              {activeSheet.summary.requirementCount} 条需求 · 预估{" "}
              {activeSheet.summary.totalEstimateHours}h · 日期警告{" "}
              {activeSheet.summary.dateWarnings}
            </div>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2">一级模块</th>
                  <th className="px-3 py-2">二级模块</th>
                  <th className="px-3 py-2">细分功能</th>
                  <th className="px-3 py-2">角色任务</th>
                  <th className="px-3 py-2">警告</th>
                </tr>
              </thead>
              <tbody>
                {activeSheet.rows.slice(0, 80).map((row, idx) => (
                  <tr key={idx} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">{row.moduleL1}</td>
                    <td className="px-3 py-2">{row.moduleL2}</td>
                    <td className="px-3 py-2">{row.subFunction ?? "—"}</td>
                    <td className="px-3 py-2">
                      {row.roles.map((r) => (
                        <div key={`${idx}-${r.role}`}>
                          {r.role}: {r.estimateHours ?? "—"}h{" "}
                          {r.assignee ? `· ${r.assignee}` : ""}
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-2 text-amber-600">
                      {row.warnings.join("；") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 px-4 py-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clearExisting}
                onChange={(e) => setClearExisting(e.target.checked)}
              />
              清空本项目已有需求后导入
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={commitExcelImport}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              确认导入
            </button>
          </div>
        </section>
      ) : null}

      {tab === "notion" && notionPreview ? (
        <section className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="font-semibold">{notionPreview.fileName}</div>
            <div className="text-sm text-slate-500">{notionPreview.rowCount} 条功能点</div>
            {notionPreview.warnings.length > 0 ? (
              <div className="mt-1 text-sm text-amber-600">
                {notionPreview.warnings.join("；")}
              </div>
            ) : null}
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2">功能点</th>
                  <th className="px-3 py-2">产品模块</th>
                  <th className="px-3 py-2">分类</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">优先级</th>
                </tr>
              </thead>
              <tbody>
                {notionPreview.rows.slice(0, 100).map((row, idx) => (
                  <tr key={idx} className="border-t border-slate-100">
                    <td className="px-3 py-2">{row.title}</td>
                    <td className="px-3 py-2">{row.moduleName ?? "—"}</td>
                    <td className="px-3 py-2">{row.category ?? "—"}</td>
                    <td className="px-3 py-2">{row.statusRaw ?? "—"}</td>
                    <td className="px-3 py-2">{row.priority ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 px-4 py-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clearPool}
                onChange={(e) => setClearPool(e.target.checked)}
              />
              清空需求池后导入
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={commitNotionImport}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              导入到需求池
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
