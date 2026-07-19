"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const KIND_LABELS: Record<string, string> = {
  star: "灵感星",
  planet: "已落地星球",
  meteor: "废弃流星",
};

const DATE_LABELS: Record<string, string> = {
  today: "今日新增",
  yesterday: "昨日",
};

export function StreamActiveFilters({
  date,
  kind,
  ideaTitle,
  includePooled,
}: {
  date?: string | null;
  kind?: string | null;
  ideaTitle?: string | null;
  includePooled?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const chips: { key: string; label: string }[] = [];
  if (date) chips.push({ key: "date", label: DATE_LABELS[date] ?? `日期 ${date}` });
  if (kind) chips.push({ key: "kind", label: KIND_LABELS[kind] ?? kind });
  if (ideaTitle) chips.push({ key: "idea", label: `定位：${ideaTitle}` });
  if (includePooled) chips.push({ key: "pooled", label: "含已入池" });

  if (chips.length === 0) return null;

  const clearHref = (() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("date");
    params.delete("kind");
    params.delete("idea");
    params.delete("pooled");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/80 px-3 py-2 text-xs text-indigo-800">
      <span className="font-medium">当前筛选</span>
      {chips.map((chip) => (
        <span key={chip.key} className="rounded-full bg-white px-2.5 py-0.5 ring-1 ring-indigo-100">
          {chip.label}
        </span>
      ))}
      <Link href={clearHref} className="ml-auto font-medium text-indigo-600 hover:underline">
        清除
      </Link>
    </div>
  );
}
