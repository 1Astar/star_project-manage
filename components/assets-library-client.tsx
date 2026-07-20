"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PortfolioPromptPanel } from "@/components/studio/portfolio-prompt-panel";
import { StudioBadge } from "@/components/studio/shell";
import {
  ASSET_TYPE_CREATE_OPTIONS,
  ASSET_TYPE_LABELS,
  type Asset,
  type AssetType,
} from "@/lib/studio/types";
import { cn } from "@/lib/utils";

export const GLOBAL_FILTER = "__global__";

type Row = {
  asset: Asset;
  projectName: string;
};

type Props = {
  rows: Row[];
  projects: Array<{ id: string; label: string }>;
  projectFilter: string | null;
};

function normalizeType(t: AssetType): AssetType {
  if (t === "competitor" || t === "inspiration") return "material";
  if (t === "ui_ref") return "design";
  if (t === "tech_doc") return "doc";
  return t;
}

export function AssetsLibraryClient({ rows, projects, projectFilter }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");
  const isGlobal = projectFilter === GLOBAL_FILTER;

  function setProject(value: string) {
    if (!value) {
      router.push("/assets");
      return;
    }
    router.push(`/assets?project=${encodeURIComponent(value)}`);
  }

  const filtered = useMemo(() => {
    if (isGlobal) return [];
    const needle = q.trim().toLowerCase();
    return rows.filter(({ asset, projectName }) => {
      if (typeFilter !== "all" && normalizeType(asset.assetType) !== typeFilter) {
        return false;
      }
      if (!needle) return true;
      const hay = [
        asset.title,
        asset.note,
        asset.takeaway,
        asset.url,
        projectName,
        ASSET_TYPE_LABELS[asset.assetType],
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, typeFilter, isGlobal]);

  const typeCounts = useMemo(() => {
    const map = new Map<AssetType | "all", number>();
    map.set("all", rows.length);
    for (const t of ASSET_TYPE_CREATE_OPTIONS) map.set(t, 0);
    for (const { asset } of rows) {
      const t = normalizeType(asset.assetType);
      map.set(t, (map.get(t) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-xs font-medium text-slate-500">范围</span>
        <select
          value={projectFilter ?? ""}
          onChange={(e) => setProject(e.target.value)}
          className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="">全部项目</option>
          <option value={GLOBAL_FILTER}>全局</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        {!isGlobal ? (
          <>
            <span className="ml-2 text-xs font-medium text-slate-500">搜索</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="标题 / 备注 / 链接 / 项目名"
              className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
            />
            {(q || typeFilter !== "all" || projectFilter) && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setTypeFilter("all");
                  setProject("");
                }}
                className="text-xs text-indigo-600 hover:underline"
              >
                清除
              </button>
            )}
          </>
        ) : null}
      </div>

      {isGlobal ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            全局模板与跨项目复用材料。作品集 Prompt 只在这里维护，不挂到各项目「项目恢复」。
          </p>
          <PortfolioPromptPanel />
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-800">文档模板</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/1Astar/star_project-manage/blob/main/docs/templates/case-study-template.md"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  Case Study 空模板 →
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/1Astar/star_project-manage/blob/main/docs/templates/product-concept-template.md"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  产品 Concept 模板 →
                </a>
              </li>
              <li>
                <Link href="/assets" className="text-slate-500 hover:underline">
                  返回全部项目资料 →
                </Link>
              </li>
            </ul>
          </section>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <TypeChip
              active={typeFilter === "all"}
              onClick={() => setTypeFilter("all")}
              label={`全部 ${typeCounts.get("all") ?? 0}`}
            />
            {ASSET_TYPE_CREATE_OPTIONS.map((t) => {
              const n = typeCounts.get(t) ?? 0;
              if (n === 0) return null;
              return (
                <TypeChip
                  key={t}
                  active={typeFilter === t}
                  onClick={() => setTypeFilter(t)}
                  label={`${ASSET_TYPE_LABELS[t]} ${n}`}
                />
              );
            })}
          </div>

          <p className="text-xs text-slate-400">
            共 {filtered.length} 条
            {q.trim() ? ` · 含「${q.trim()}」` : ""}
          </p>

          {filtered.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              {rows.length === 0
                ? "暂无资料，可在各项目「资源中心」添加"
                : "没有匹配的资料，试试换关键词或类型"}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">标题</th>
                    <th className="px-3 py-3 font-medium">类型</th>
                    <th className="px-3 py-3 font-medium">项目</th>
                    <th className="px-3 py-3 font-medium">备注</th>
                    <th className="px-3 py-3 font-medium">链接</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(({ asset, projectName }) => (
                    <tr key={asset.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">{asset.title}</td>
                      <td className="px-3 py-3">
                        <StudioBadge>
                          {ASSET_TYPE_LABELS[normalizeType(asset.assetType)]}
                        </StudioBadge>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/projects/${asset.projectId}/resources`}
                          className="text-indigo-600 hover:underline"
                        >
                          {projectName}
                        </Link>
                      </td>
                      <td className="max-w-[240px] truncate px-3 py-3 text-slate-500">
                        {asset.note || asset.takeaway || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {asset.url ? (
                          <a
                            href={asset.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 hover:underline"
                          >
                            打开 →
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TypeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg px-2.5 py-1 text-xs font-medium transition",
        active
          ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      )}
    >
      {label}
    </button>
  );
}
