"use client";

import Link from "next/link";
import {
  FEATURE_COMPETITOR_DEFAULT_HASH,
  MARKET_COMPETITOR_FORMAL_URL,
  MARKET_COMPETITOR_LINK_STATUS,
  MARKET_COMPETITOR_PREVIEW_URL,
} from "@/lib/competitor/links";
import { WorkbookImportPanel } from "@/components/workbook-import-panel";
import type { CompetitorEntry } from "@/lib/types";

export function CompetitorsHubClient({
  routeId,
  entries = [],
}: {
  routeId: string;
  entries?: CompetitorEntry[];
}) {
  const featuresHref = `/projects/${routeId}/competitors/features#${FEATURE_COMPETITOR_DEFAULT_HASH}`;
  const marketFormal = MARKET_COMPETITOR_LINK_STATUS === "formal";
  const marketPrimaryUrl = marketFormal
    ? MARKET_COMPETITOR_FORMAL_URL
    : MARKET_COMPETITOR_PREVIEW_URL;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Competitor Analysis · 竞品研究工作台
        </p>
        <h2 className="text-xl font-semibold text-slate-900">竞品分析</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
          两个子入口不是换皮链接：各自写清用途、使用的工具与入口状态。工具继续独立运行，由
          PM 统一访问；分析报告 / 资料库等后续再扩，不必一次做完。
        </p>
      </header>

      <WorkbookImportPanel projectSlug={routeId} compact />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            竞品条目 · {entries.length}
          </h3>
          <p className="text-xs text-slate-500">
            可被学习 / 需求 / Bug 交叉引用；总表「竞品」Sheet 写入这里
          </p>
        </div>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            暂无条目。下载总表模板填「竞品」Sheet 后上传，或后续在此手工新建。
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {entries.map((e) => (
              <li key={e.id} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-slate-900">{e.title}</p>
                  {e.url ? (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      外链 ↗
                    </a>
                  ) : null}
                </div>
                {e.summary ? (
                  <p className="mt-1 text-sm text-slate-600">{e.summary}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-slate-400">
                  关联 学习 {e.linked_learning_note_ids.length} · 需求{" "}
                  {e.linked_requirement_ids.length} · Bug {e.linked_bug_ids.length}
                  {e.module_path ? ` · ${e.module_path}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
              01 市场竞品分析
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                marketFormal
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-800"
              }`}
            >
              {marketFormal ? "正式链接已配置" : "正式链接待配置"}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">
            市场、定位与竞争格局
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            研究市场、竞品定位、目标用户、商业模式、竞争格局与产品战略。回答：为什么用户选择某个产品？做什么、服务谁、如何竞争？
          </p>
          <dl className="mt-4 space-y-2 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-xs font-semibold text-slate-500">
                工具
              </dt>
              <dd>
                独立分析工具{" "}
                <code className="rounded bg-white px-1 text-xs">
                  competitive_analysis
                </code>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-xs font-semibold text-slate-500">
                状态
              </dt>
              <dd>
                {marketFormal
                  ? "已配置 Cloudflare / 正式域名。"
                  : "当前以夸克最新版本为准；待合并 Git / Vercel 后配置正式 Cloudflare 链接。勿把临时预览当成正式地址。"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-xs font-semibold text-slate-500">
                产物
              </dt>
              <dd>竞品报告、市场判断、战略机会</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={marketPrimaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              {marketFormal
                ? "打开市场竞品分析工具 ↗"
                : "临时预览市场工具（非正式）↗"}
            </a>
          </div>
          {!marketFormal ? (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-800/90">
              正式入口：待配置。临时预览：{MARKET_COMPETITOR_PREVIEW_URL}
              （可先试用，合仓部署后改环境变量{" "}
              <code className="rounded bg-amber-100/80 px-1">
                NEXT_PUBLIC_COMPETITIVE_ANALYSIS_URL
              </code>
              ）。
            </p>
          ) : (
            <p className="mt-2 break-all text-[11px] text-slate-400">
              {MARKET_COMPETITOR_FORMAL_URL}
            </p>
          )}
        </article>

        <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              02 功能竞品分析
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
              离线地图已接入
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">
            页面、模块与体验对照
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            研究具体页面、功能模块、交互流程、功能差异、设计方案与可优化点。回答：为什么某个功能这样设计？功能怎么做、页面怎么优化？
          </p>
          <dl className="mt-4 space-y-2 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-xs font-semibold text-slate-500">
                工具
              </dt>
              <dd>现有 NAS 竞品学习地图（外链 / 站内嵌入，不必重做）</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-xs font-semibold text-slate-500">
                状态
              </dt>
              <dd>
                已挂离线版到站内；默认打开能力地图 / 竞品对照等板块。
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-xs font-semibold text-slate-500">
                产物
              </dt>
              <dd>功能对照表、页面参考、优化方案</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={featuresHref}
              className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              打开功能竞品分析
            </Link>
            <a
              href={`/competitor-maps/nas-offline.html#${FEATURE_COMPETITOR_DEFAULT_HASH}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              新开完整地图 ↗
            </a>
          </div>
        </article>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            两个入口有什么区别？
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">对比维度</th>
                <th className="px-4 py-3 font-semibold">市场竞品分析</th>
                <th className="px-4 py-3 font-semibold">功能竞品分析</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="px-4 py-3 font-medium text-slate-500">核心问题</td>
                <td className="px-4 py-3">为什么用户选择某个产品？</td>
                <td className="px-4 py-3">为什么某个功能这样设计？</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-500">分析对象</td>
                <td className="px-4 py-3">公司、产品、市场、用户</td>
                <td className="px-4 py-3">页面、模块、流程、交互</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-500">主要产物</td>
                <td className="px-4 py-3">竞品报告、市场判断、战略机会</td>
                <td className="px-4 py-3">功能对照表、页面参考、优化方案</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-500">常见决策</td>
                <td className="px-4 py-3">做什么产品、服务谁、如何竞争</td>
                <td className="px-4 py-3">功能怎么做、页面怎么优化</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-slate-500">现有工具</td>
                <td className="px-4 py-3">competitive_analysis</td>
                <td className="px-4 py-3">NAS 竞品学习地图</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="space-y-2 border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
          <p>
            <span className="font-medium text-slate-800">举例 · 市场：</span>
            为什么用户会选择群晖、极空间、绿联或飞牛？分别服务谁？市场机会在哪？
          </p>
          <p>
            <span className="font-medium text-slate-800">举例 · 功能：</span>
            这些产品的相册页有何不同？谁的搜索 / 备份 / 远程访问更好？我们该优化什么？
          </p>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-slate-400">
        竞品条目已可入库并交叉链接。后续可扩：分析报告、截图库、与市场/功能工具更深联动。学习池仍只做术语 /
        原理沉淀。
      </p>
    </div>
  );
}
