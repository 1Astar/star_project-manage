"use client";

import Link from "next/link";
import type {
  OverviewRelationBundle,
  OverviewRelationGroupKey,
  OverviewRelationItem,
} from "@/lib/overview/relations";

const CHIP: Record<OverviewRelationGroupKey, string> = {
  module: "bg-slate-100 text-slate-800 hover:bg-slate-200",
  learning: "bg-sky-50 text-sky-900 hover:bg-sky-100",
  bug: "bg-rose-50 text-rose-900 hover:bg-rose-100",
  optimization: "bg-amber-50 text-amber-950 hover:bg-amber-100",
  requirement: "bg-indigo-50 text-indigo-900 hover:bg-indigo-100",
  prd: "bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100",
  competitor: "bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
};

const TYPE_PILL: Record<string, string> = {
  知识点: "bg-sky-50 text-sky-800",
  "相关 Bug": "bg-rose-50 text-rose-800",
  优化建议: "bg-amber-50 text-amber-900",
  需求: "bg-indigo-50 text-indigo-800",
  PRD: "bg-fuchsia-50 text-fuchsia-800",
  竞品: "bg-emerald-50 text-emerald-800",
  产品板块: "bg-slate-100 text-slate-700",
};

type FlatRow = OverviewRelationItem & {
  groupKey: OverviewRelationGroupKey;
  typeLabel: string;
};

function flattenBundle(bundle: OverviewRelationBundle): FlatRow[] {
  const out: FlatRow[] = [];
  for (const g of bundle.groups) {
    if (g.key === "module") continue;
    for (const item of g.items) {
      out.push({ ...item, groupKey: g.key, typeLabel: g.label });
    }
  }
  return out;
}

/**
 * Notion 风关联：
 * - properties：属性行 + token（空显示「空」）
 * - embed：侧栏内嵌关联表（条目 / 类型）
 */
export function OverviewRelationLayer({
  bundle,
  onOpenItem,
  onClose,
  variant = "properties",
}: {
  bundle: OverviewRelationBundle;
  onOpenItem: (item: OverviewRelationItem) => void;
  onClose?: () => void;
  variant?: "properties" | "embed";
}) {
  if (variant === "embed") {
    return <RelationEmbedTable bundle={bundle} onOpenItem={onOpenItem} />;
  }

  const linkedCount = bundle.groups.reduce(
    (n, g) => n + (g.key === "module" ? 0 : g.items.length),
    0
  );

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            关联关系层
          </p>
          <p className="truncate text-sm font-semibold text-slate-900">
            <span className="mr-1.5 text-[10px] font-medium text-slate-400">
              [{bundle.rowType}]
            </span>
            {bundle.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">
            {linkedCount === 0 ? "暂无交叉关联" : `${linkedCount} 条关联`}
          </span>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
            >
              关闭
            </button>
          ) : null}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {bundle.groups.map((group) => (
          <div
            key={group.key}
            className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 px-4 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)]"
          >
            <div className="pt-0.5 text-xs font-medium text-slate-500">
              {group.label}
            </div>
            <div className="min-w-0">
              {group.items.length === 0 ? (
                <span className="text-xs text-slate-300">空</span>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {group.items.map((item) => {
                    const chipClass = `inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${CHIP[group.key]}`;
                    const label = (
                      <>
                        {item.badge ? (
                          <span className="shrink-0 text-[10px] opacity-60">
                            {item.badge}
                          </span>
                        ) : null}
                        <span className="truncate">{item.title}</span>
                      </>
                    );
                    if (item.peekKind) {
                      return (
                        <li key={`${group.key}:${item.id}`}>
                          <button
                            type="button"
                            onClick={() => onOpenItem(item)}
                            className={chipClass}
                            title="打开侧栏"
                          >
                            {label}
                          </button>
                        </li>
                      );
                    }
                    if (item.href) {
                      return (
                        <li key={`${group.key}:${item.id}`}>
                          <Link href={item.href} className={chipClass} title="打开">
                            {label}
                          </Link>
                        </li>
                      );
                    }
                    return (
                      <li key={`${group.key}:${item.id}`}>
                        <span className={chipClass}>{label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RelationEmbedTable({
  bundle,
  onOpenItem,
}: {
  bundle: OverviewRelationBundle;
  onOpenItem: (item: OverviewRelationItem) => void;
}) {
  const moduleGroup = bundle.groups.find((g) => g.key === "module");
  const moduleItem = moduleGroup?.items[0];
  const rows = flattenBundle(bundle);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 text-sm sm:grid-cols-[7.5rem_minmax(0,1fr)]">
        <div className="pt-1 text-xs font-medium text-slate-500">产品板块</div>
        <div>
          {moduleItem?.href ? (
            <Link
              href={moduleItem.href}
              className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-200"
            >
              {moduleItem.title}
            </Link>
          ) : (
            <span className="text-xs text-slate-300">空</span>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
          <p className="truncate text-xs font-semibold text-slate-800">
            {bundle.title}
            <span className="font-normal text-slate-400"> · 关联调研条目</span>
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-400">
            暂无关联条目。可在详情页挂接知识点 / Bug / 竞品等。
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] text-slate-400">
                <th className="px-3 py-2 font-medium">条目</th>
                <th className="px-3 py-2 font-medium" style={{ width: "5.5rem" }}>
                  类型
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.groupKey}:${row.id}`}
                  className="border-b border-slate-50 last:border-0"
                >
                  <td className="px-3 py-2 align-middle">
                    {row.peekKind ? (
                      <button
                        type="button"
                        onClick={() => onOpenItem(row)}
                        className="text-left text-sm text-indigo-700 hover:underline"
                      >
                        {row.title}
                      </button>
                    ) : row.href ? (
                      <Link
                        href={row.href}
                        className="text-sm text-indigo-700 hover:underline"
                      >
                        {row.title}
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-800">{row.title}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        TYPE_PILL[row.typeLabel] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {row.typeLabel.replace(/^相关 /, "")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
