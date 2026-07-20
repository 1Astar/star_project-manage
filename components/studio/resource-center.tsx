"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AddAssetForm } from "@/components/studio/add-asset-form";
import { ProjectAssetsTable } from "@/components/studio/project-assets-table";
import {
  RESOURCE_CATEGORIES,
  assetTypeLabel,
  buildAutoResourceItems,
  countAssetsInCategory,
  normalizeAssetCategory,
  type ResourceCategoryId,
} from "@/lib/studio/asset-categories";
import type { Asset, AssetType, Project, StudioRelease } from "@/lib/studio/types";
import { partitionReleaseTags } from "@/lib/studio/release-notes";
import { cn } from "@/lib/utils";

type Props = {
  project: Project;
  assets: Asset[];
  releases: StudioRelease[];
};

const VERSION_STORAGE = (projectId: string) => `star-pm:resource-version:${projectId}`;

export function ResourceCenter({ project, assets, releases }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [active, setActive] = useState<ResourceCategoryId | "all">("all");
  const [versionTag, setVersionTag] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VERSION_STORAGE(project.id));
      if (raw) setVersionTag(raw);
    } catch {
      /* ignore */
    }
  }, [project.id]);

  const auto = useMemo(
    () => buildAutoResourceItems(project, { releaseTag: versionTag || null }),
    [project, versionTag]
  );

  const categoryCounts = useMemo(() => {
    const map = Object.fromEntries(
      RESOURCE_CATEGORIES.map((c) => [c.id, countAssetsInCategory(assets, c.id)])
    ) as Record<ResourceCategoryId, number>;
    map.experience += auto.experience.length;
    map.repo += auto.repo.length;
    map.deploy += auto.deploy.length;
    return map;
  }, [assets, auto]);

  const filteredAssets =
    active === "all"
      ? assets
      : assets.filter((a) => normalizeAssetCategory(a.assetType) === active);

  const autoForActive =
    active === "experience"
      ? auto.experience
      : active === "repo"
        ? auto.repo
        : active === "deploy"
          ? auto.deploy
          : active === "all"
            ? [...auto.experience, ...auto.repo, ...auto.deploy]
            : [];

  const defaultType: AssetType =
    active === "all" ? "material" : (active as AssetType);

  const selectedRelease = versionTag
    ? releases.find((r) => r.tag === versionTag)
    : null;

  const { semver: semverReleases, process: processReleases } = useMemo(
    () =>
      partitionReleaseTags(
        [...releases].sort((a, b) =>
          (b.publishedAt ?? b.syncedAt).localeCompare(a.publishedAt ?? a.syncedAt)
        )
      ),
    [releases]
  );

  function persistVersion(tag: string) {
    setVersionTag(tag);
    try {
      if (tag) localStorage.setItem(VERSION_STORAGE(project.id), tag);
      else localStorage.removeItem(VERSION_STORAGE(project.id));
    } catch {
      /* ignore */
    }
  }

  function syncReleases() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/studio/projects/${project.id}/releases/sync`, {
          method: "POST",
        });
        const json = (await res.json()) as {
          error?: string;
          synced?: number;
        };
        if (!res.ok) {
          throw new Error(json.error || "同步失败");
        }
        setMessage(`已同步 ${json.synced ?? 0} 个版本${
          typeof (json as { changelogFilled?: number }).changelogFilled === "number" &&
          (json as { changelogFilled?: number }).changelogFilled! > 0
            ? `（${(json as { changelogFilled?: number }).changelogFilled} 个 Tag 已补 commits 说明）`
            : ""
        }${
          typeof (json as { evolutionImported?: number }).evolutionImported === "number" &&
          (json as { evolutionImported?: number }).evolutionImported! > 0
            ? `；导入 ${(json as { evolutionImported?: number }).evolutionImported} 条版本需求`
            : ""
        }`);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "同步失败");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">项目资源中心</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              体验 / 代码 / 部署从项目配置带出；选择版本后代码链接指向对应 Tag。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="shrink-0">版本</span>
              <select
                value={versionTag}
                onChange={(e) => persistVersion(e.target.value)}
                className="max-w-[180px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
              >
                <option value="">全部（默认分支）</option>
                {semverReleases.length > 0 ? (
                  <optgroup label="语义化版本">
                    {semverReleases.map((r) => (
                      <option key={r.id} value={r.tag}>
                        {r.name || r.tag}
                        {r.source === "tag" ? " · Tag" : ""}
                        {r.isPrerelease ? " · pre" : ""}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {processReleases.length > 0 ? (
                  <optgroup label="过程 Tag">
                    {processReleases.map((r) => (
                      <option key={r.id} value={r.tag}>
                        {r.name || r.tag}
                        {r.source === "tag" ? " · Tag" : ""}
                        {r.isPrerelease ? " · pre" : ""}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
            <button
              type="button"
              disabled={pending || !project.githubRepo}
              onClick={syncReleases}
              title={project.githubRepo ? "从 GitHub 同步 Release/Tag" : "请先绑定 GitHub 仓库"}
              className="btn-secondary"
            >
              {pending ? "同步中…" : "同步版本"}
            </button>
            <AddAssetForm projectId={project.id} defaultAssetType={defaultType} />
          </div>
        </div>

        {message ? (
          <p className="mb-2 text-xs text-slate-500">{message}</p>
        ) : null}

        {selectedRelease ? (
          <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-xs text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-indigo-800">
                  {selectedRelease.name || selectedRelease.tag}
                </span>
                <span className="ml-2 text-slate-500">{selectedRelease.tag}</span>
                {selectedRelease.publishedAt ? (
                  <span className="ml-2 text-slate-400">
                    {selectedRelease.publishedAt.slice(0, 10)}
                  </span>
                ) : null}
              </div>
              {selectedRelease.htmlUrl ? (
                <a
                  href={selectedRelease.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-indigo-600 hover:underline"
                >
                  打开 Release →
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCE_CATEGORIES.map((cat) => {
            const selected = active === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActive(selected ? "all" : cat.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition",
                  selected
                    ? "border-indigo-300 bg-indigo-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{cat.label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {categoryCounts[cat.id]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{cat.desc}</p>
                {cat.auto ? (
                  <p className="mt-2 text-[10px] font-medium text-indigo-600">半自动 · 读项目配置</p>
                ) : (
                  <p className="mt-2 text-[10px] text-slate-400">手动添加</p>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setActive("all")}
            className={cn(
              "text-xs font-medium",
              active === "all" ? "text-indigo-700" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {active === "all" ? "当前：全部资源" : "显示全部资源"}
          </button>
        </div>
      </section>

      {autoForActive.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-500">
            来自项目配置
          </div>
          <ul className="divide-y divide-slate-100">
            {autoForActive.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{item.title}</p>
                  {item.note ? (
                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500">{item.note}</p>
                  ) : null}
                </div>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs font-medium text-indigo-600 hover:underline"
                  >
                    打开 →
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-700">
            {active === "all" ? "已登记资料" : `${assetTypeLabel(active)} · 已登记`}
          </h3>
        </div>
        <ProjectAssetsTable assets={filteredAssets} />
      </section>
    </div>
  );
}
