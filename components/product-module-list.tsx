import Link from "next/link";
import type { ProductModuleSummary } from "@/lib/modules/product-module-home";

export function ProductModuleList({
  projectSlug,
  modules,
}: {
  projectSlug: string;
  modules: ProductModuleSummary[];
}) {
  if (modules.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-base font-semibold text-slate-900">产品模块</h2>
        <p className="mt-2 text-sm text-slate-600">
          还没有可展示的模块。可在项目设置里配置功能板块，或先在学习池建「板块」、给 Bug/竞品/PRD 填模块路径。
        </p>
        <Link
          href={`/projects/${projectSlug}/overview`}
          className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
        >
          ← 回总览表
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">产品模块</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          点进模块主页看简介与相关需求 / PRD / Bug / 知识点。共 {modules.length} 个。
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => {
          const total =
            m.counts.learning +
            m.counts.requirement +
            m.counts.prd +
            m.counts.bug +
            m.counts.competitor;
          return (
            <li key={m.key}>
              <Link
                href={`/projects/${projectSlug}/modules/${m.key}`}
                className="block h-full rounded-xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:bg-indigo-50/40"
              >
                <h3 className="text-sm font-semibold text-slate-900">{m.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                  {m.bio.trim() || "暂无简介"}
                </p>
                <p className="mt-3 text-[11px] text-slate-400">
                  {total === 0
                    ? "尚无关联条目"
                    : [
                        m.counts.learning ? `知识 ${m.counts.learning}` : null,
                        m.counts.requirement ? `需求 ${m.counts.requirement}` : null,
                        m.counts.prd ? `PRD ${m.counts.prd}` : null,
                        m.counts.bug ? `Bug ${m.counts.bug}` : null,
                        m.counts.competitor ? `竞品 ${m.counts.competitor}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
