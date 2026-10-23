"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FEATURE_COMPETITOR_DEFAULT_HASH,
  FEATURE_COMPETITOR_MAP_PATH,
  FEATURE_COMPETITOR_SECTION_LINKS,
} from "@/lib/competitor/links";

export function CompetitorsFeaturesClient({ routeId }: { routeId: string }) {
  const [hash, setHash] = useState(FEATURE_COMPETITOR_DEFAULT_HASH);
  const src = useMemo(
    () => `${FEATURE_COMPETITOR_MAP_PATH}#${hash}`,
    [hash]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            <Link
              href={`/projects/${routeId}/competitors`}
              className="text-indigo-600 hover:underline"
            >
              ← 竞品入口
            </Link>
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">
            02 功能竞品分析
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            研究页面、模块、交互与可优化点。嵌入 NAS
            竞品学习地图的竞品板块（能力对照 / 品牌资料等），保留独立网页，不在此重做整套功能。
          </p>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          新开完整地图 ↗
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {FEATURE_COMPETITOR_SECTION_LINKS.map((item) => {
          const active = hash === item.hash;
          return (
            <button
              key={item.hash}
              type="button"
              onClick={() => setHash(item.hash)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                active
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <iframe
          key={src}
          title="NAS 功能竞品学习地图"
          src={src}
          className="h-[min(78vh,900px)] w-full border-0"
        />
      </div>
    </div>
  );
}
