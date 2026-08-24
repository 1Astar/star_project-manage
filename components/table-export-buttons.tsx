"use client";

export function TableExportButtons({
  kind,
  project,
  label = "导出",
}: {
  kind: string;
  project?: string | null;
  label?: string;
}) {
  const params = new URLSearchParams({ kind });
  if (project) params.set("project", project);
  const qs = params.toString();

  return (
    <span className="inline-flex items-center gap-1 text-xs">
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
    </span>
  );
}
