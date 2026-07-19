"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StudioBadge } from "@/components/studio/shell";
import { publicStudioAssetUrl } from "@/lib/studio/asset-url";
import { assetTypeLabel } from "@/lib/studio/asset-categories";
import type { Asset } from "@/lib/studio/types";
import { parseAgentSourceLabel } from "@/lib/cursor-actor";

type ProjectAssetsTableProps = {
  assets: Asset[];
};

export function ProjectAssetsTable({ assets: initialAssets }: ProjectAssetsTableProps) {
  const router = useRouter();
  const [assets, setAssets] = useState(initialAssets);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setAssets(initialAssets);
  }, [initialAssets]);

  async function handleDelete(asset: Asset) {
    const ok = window.confirm(`删除「${asset.title}」？`);
    if (!ok) return;

    setDeletingId(asset.id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/studio/assets/${asset.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "删除失败");
        return;
      }
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setMessage("已删除");
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setDeletingId(null);
    }
  }

  if (assets.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          暂无资料，点击上方「+ 新增链接」添加。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">标题</th>
              <th className="px-3 py-2.5 font-medium">类型</th>
              <th className="px-3 py-2.5 font-medium">链接</th>
              <th className="px-3 py-2.5 font-medium">可借鉴</th>
              <th className="px-3 py-2.5 font-medium w-24">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-slate-50/80">
                <td className="px-3 py-2 font-medium text-slate-800">{asset.title}</td>
                <td className="px-3 py-2">
                  <StudioBadge>{assetTypeLabel(asset.assetType)}</StudioBadge>
                </td>
                <td className="px-3 py-2">
                  {asset.storagePath ? (
                    <a
                      href={asset.url || publicStudioAssetUrl(asset.storagePath)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-indigo-600 hover:underline"
                    >
                      {asset.mimeType?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.url || publicStudioAssetUrl(asset.storagePath)}
                          alt={asset.title}
                          className="h-10 w-16 rounded border border-slate-200 object-cover"
                        />
                      ) : null}
                      查看 →
                    </a>
                  ) : asset.url ? (
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      打开 →
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="max-w-xs px-3 py-2 text-slate-600" title={asset.takeaway}>
                  {(() => {
                    const parsed = parseAgentSourceLabel(asset.takeaway);
                    if (parsed.label) {
                      return (
                        <span className="block truncate">
                          <span className="font-medium text-slate-700">{parsed.label}</span>
                          {parsed.note ? (
                            <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                              {parsed.note}
                            </span>
                          ) : null}
                        </span>
                      );
                    }
                    if (!parsed.note) return <span className="text-slate-400">—</span>;
                    return <span className="block truncate">{parsed.note}</span>;
                  })()}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={deletingId === asset.id}
                    onClick={() => handleDelete(asset)}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deletingId === asset.id ? "删除中…" : "删除"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
