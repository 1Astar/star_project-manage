"use client";

export function TableExportButtons({
  kind,
  project,
  label = "导出",
  ids,
  scope,
  hint,
}: {
  kind: string;
  project?: string | null;
  label?: string;
  /** 仅导出这些 id；优先于 scope */
  ids?: string[] | null;
  /** bugs 等：未勾选时按筛选导出 */
  scope?: "open" | "all" | null;
  hint?: string | null;
}) {
  const params = new URLSearchParams({ kind });
  if (project) params.set("project", project);
  if (ids && ids.length > 0) params.set("ids", ids.join(","));
  else if (scope === "open" || scope === "all") params.set("scope", scope);
  const qs = params.toString();

  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs">
      <span className="text-slate-400">{label}</span>
      <a
        href={`/api/export?${qs}&format=xlsx`}
        className="rounded-lg border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50"
      >
        Excel
      </a>
      <a
        href={`/api/export?${qs}&format=csv`}
        className="rounded-lg border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50"
      >
        CSV
      </a>
      {hint ? <span className="text-slate-400">{hint}</span> : null}
    </span>
  );
}
