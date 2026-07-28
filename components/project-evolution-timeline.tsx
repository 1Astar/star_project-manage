"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProjectChangeSessions } from "@/components/project-change-sessions";
import { ModuleProgressTable } from "@/components/module-progress-table";
import { StudioBadge } from "@/components/studio/shell";
import { parseFeaturePathToChain, resolveFeatureModules } from "@/lib/studio/project-modules";
import { inferChangeDirection, inferModulesFromText } from "@/lib/studio/infer-modules";
import { extractReleaseBodyItems, partitionReleaseTags } from "@/lib/studio/release-notes";
import {
  EVOLUTION_TYPE_LABELS,
  type ChangeSession,
  type EvolutionLog,
  type EvolutionLogType,
  type Idea,
  type Project,
  type StudioRelease,
} from "@/lib/studio/types";
import type { Iteration } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  project: Project;
  releases: StudioRelease[];
  evolution: EvolutionLog[];
  ideas: Idea[];
  iterations: Iteration[];
  changeSessions: ChangeSession[];
};

type TabKey = "releases" | "modules" | "changes";
/** 板块演进：空串=全部；按「体系·功能面」路径前缀筛选 */
type ModuleLevelFilter = { l1: string; l2: string };

function modulePathPrefix(filter: ModuleLevelFilter): string | null {
  if (!filter.l1) return null;
  if (!filter.l2) return filter.l1;
  return `${filter.l1}·${filter.l2}`;
}

function moduleMatchesPrefix(path: string, prefix: string | null): boolean {
  if (!prefix) return true;
  return path === prefix || path.startsWith(`${prefix}·`);
}

function countForPaths(
  paths: string[],
  stats: Array<{ module: string; evolution: EvolutionLog[]; ideas: Idea[] }>
) {
  const set = new Set(paths);
  return stats
    .filter((s) => set.has(s.module))
    .reduce((n, s) => n + s.evolution.length + s.ideas.length, 0);
}

const LOG_TYPES = Object.keys(EVOLUTION_TYPE_LABELS) as EvolutionLogType[];

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("zh-CN");
  } catch {
    return iso;
  }
}

export function ProjectEvolutionTimeline({
  project,
  releases,
  evolution,
  ideas,
  iterations,
  changeSessions,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<TabKey>("releases");
  const [moduleFilter, setModuleFilter] = useState<ModuleLevelFilter>({ l1: "", l2: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const modules = useMemo(
    () => resolveFeatureModules(project.id, project.featureModules, project.githubRepo),
    [project.id, project.featureModules, project.githubRepo]
  );

  const [form, setForm] = useState({
    title: "",
    logType: "feature_add" as EvolutionLogType,
    after: "",
    reason: "",
    decision: "",
    module: modules[0] ?? "",
    releaseTag: "",
  });

  const sortedReleases = useMemo(
    () =>
      [...releases].sort((a, b) =>
        (b.publishedAt ?? b.syncedAt).localeCompare(a.publishedAt ?? a.syncedAt)
      ),
    [releases]
  );

  const { semver: semverReleases, process: processReleases } = useMemo(
    () => partitionReleaseTags(sortedReleases),
    [sortedReleases]
  );

  const untaggedEvolution = useMemo(
    () => evolution.filter((e) => !e.releaseTag?.trim()),
    [evolution]
  );

  const moduleStats = useMemo(() => {
    return modules.map((m) => ({
      module: m,
      evolution: evolution.filter((e) => (e.module || "").trim() === m),
      ideas: ideas.filter((i) => (i.relatedModule || "").trim() === m),
    }));
  }, [modules, evolution, ideas]);

  const moduleTree = useMemo(() => {
    const l1Map = new Map<string, Set<string>>();
    for (const m of modules) {
      const chain = parseFeaturePathToChain(m);
      if (chain.length === 0) continue;
      const l1 = chain[0];
      if (!l1Map.has(l1)) l1Map.set(l1, new Set());
      if (chain[1]) l1Map.get(l1)!.add(chain[1]);
    }
    return Array.from(l1Map.entries())
      .sort(([a], [b]) => a.localeCompare(b, "zh-CN"))
      .map(([l1, l2set]) => ({
        l1,
        l2: Array.from(l2set).sort((a, b) => a.localeCompare(b, "zh-CN")),
      }));
  }, [modules]);

  const l2Options = useMemo(() => {
    if (!moduleFilter.l1) return [] as string[];
    return moduleTree.find((n) => n.l1 === moduleFilter.l1)?.l2 ?? [];
  }, [moduleTree, moduleFilter.l1]);

  function modulesForRelease(tag: string, body?: string | null) {
    const set = new Set<string>();
    for (const e of evolution) {
      if (e.releaseTag === tag && e.module?.trim()) set.add(e.module.trim());
    }
    // 尚无挂板块的演进时，直接从本版说明文案推断（避免「有说明却显示未关联板块」）
    if (set.size === 0 && body?.trim()) {
      for (const m of inferModulesFromText(body, {
        projectId: project.id,
        githubRepo: project.githubRepo,
        allowed: modules,
      })) {
        set.add(m);
      }
    }
    return Array.from(set);
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
          changelogFilled?: number;
          evolutionImported?: number;
        };
        if (!res.ok) throw new Error(json.error || "同步失败");
        const filled =
          typeof json.changelogFilled === "number" && json.changelogFilled > 0
            ? `，其中 ${json.changelogFilled} 个 Tag 已用 commits 补全变更说明`
            : "";
        const evo =
          typeof json.evolutionImported === "number" && json.evolutionImported > 0
            ? `；已导入 ${json.evolutionImported} 条版本需求（关键词推断板块）`
            : "";
        setMessage(`已同步 ${json.synced ?? 0} 个版本（Tag/Release）${filled}${evo}`);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "同步失败");
      }
    });
  }

  function submitEvolution(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setMessage("标题必填");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/studio/evolution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title.trim(),
            projectId: project.id,
            logType: form.logType,
            after: form.after.trim(),
            reason: form.reason.trim(),
            decision: form.decision.trim(),
            module: form.module.trim(),
            releaseTag: form.releaseTag.trim() || null,
          }),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(json.error || "保存失败");
        setForm((f) => ({
          ...f,
          title: "",
          after: "",
          reason: "",
          decision: "",
        }));
        setShowForm(false);
        setMessage("已添加演进记录");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      }
    });
  }

  const reasonEmpty = !form.reason.trim();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">迭代记录</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            「同步版本」拉 Tag/Release；仅在语义化版本之间用 commits 补变更；说明条目导入为演进并推断功能板块；过程 Tag 默认折叠。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !project.githubRepo}
            onClick={syncReleases}
            className="btn-secondary"
            style={{ backgroundColor: "#ffffff", color: "#1e293b", border: "1px solid #cbd5e1" }}
            title={project.githubRepo ? "从 GitHub 同步 Release/Tag" : "请先配置 GitHub 仓库"}
          >
            {pending ? "同步中…" : "同步版本"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="btn-secondary"
            style={{ backgroundColor: "#ffffff", color: "#1e293b", border: "1px solid #cbd5e1" }}
          >
            {showForm ? "收起表单" : "+ 补一条演进"}
          </button>
        </div>
      </div>

      {message ? <p className="text-xs text-slate-600">{message}</p> : null}

      {showForm ? (
        <form
          onSubmit={submitEvolution}
          className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm md:col-span-2">
              <span className="text-slate-500">标题</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="例如：迭代记录页加发版时间线"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">类型</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.logType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, logType: e.target.value as EvolutionLogType }))
                }
              >
                {LOG_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EVOLUTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">板块</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.module}
                onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))}
              >
                <option value="">未指定</option>
                {modules.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">关联版本</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.releaseTag}
                onChange={(e) => setForm((f) => ({ ...f, releaseTag: e.target.value }))}
              >
                <option value="">未挂版本</option>
                {semverReleases.length > 0 ? (
                  <optgroup label="语义化版本">
                    {semverReleases.map((r) => (
                      <option key={r.id} value={r.tag}>
                        {r.tag}
                        {r.name && r.name !== r.tag ? ` · ${r.name}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {processReleases.length > 0 ? (
                  <optgroup label="过程 Tag">
                    {processReleases.map((r) => (
                      <option key={r.id} value={r.tag}>
                        {r.tag}
                        {r.name && r.name !== r.tag ? ` · ${r.name}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-slate-500">变化后 / 影响</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                rows={2}
                value={form.after}
                onChange={(e) => setForm((f) => ({ ...f, after: e.target.value }))}
              />
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-slate-500">为什么改（可选）</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                rows={2}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="以后追溯会用到"
              />
              {reasonEmpty ? (
                <p className="mt-1 text-xs text-amber-700">
                  建议补一句原因，不然以后可能想不起为什么要动这个板块。
                </p>
              ) : null}
            </label>
            <label className="block text-sm md:col-span-2">
              <span className="text-slate-500">结论</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.decision}
                onChange={(e) => setForm((f) => ({ ...f, decision: e.target.value }))}
              />
            </label>
          </div>
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "保存中…" : "保存"}
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
        <TabButton active={tab === "releases"} onClick={() => setTab("releases")}>
          项目发版
        </TabButton>
        <TabButton
          active={tab === "modules"}
          onClick={() => {
            setTab("modules");
            setModuleFilter({ l1: "", l2: "" });
          }}
        >
          板块演进
        </TabButton>
        <TabButton active={tab === "changes"} onClick={() => setTab("changes")}>
          AI 变更
        </TabButton>
      </div>

      {tab === "releases" ? (
        <div className="space-y-4">
          {sortedReleases.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              暂无发版记录。配置 GitHub 仓库后点「同步版本」，或在下方「未挂版本」查看演进。
            </p>
          ) : (
            <>
              {semverReleases.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  暂无语义化版本 Tag（如 v1.2.3）。过程 Tag 已折叠在下方。
                </p>
              ) : (
                semverReleases.map((release) => (
                  <ReleaseArticle
                    key={release.id}
                    release={release}
                    evolution={evolution}
                    iterations={iterations}
                    modulesForRelease={modulesForRelease}
                  />
                ))
              )}

              {processReleases.length > 0 ? (
                <details className="rounded-xl border border-slate-200 bg-white">
                  <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    过程 Tag（{processReleases.length}）
                    <span className="ml-2 font-normal text-slate-400">
                      stage/、nest/ 等非语义化 Tag，默认折叠
                    </span>
                  </summary>
                  <div className="space-y-4 border-t border-slate-100 p-4">
                    {processReleases.map((release) => (
                      <ReleaseArticle
                        key={release.id}
                        release={release}
                        evolution={evolution}
                        iterations={iterations}
                        modulesForRelease={modulesForRelease}
                      />
                    ))}
                  </div>
                </details>
              ) : null}
            </>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">未挂版本</h3>
            {untaggedEvolution.length === 0 ? (
              <p className="text-sm text-slate-500">没有未挂版本的演进。</p>
            ) : (
              untaggedEvolution.map((log) => <EvolutionCard key={log.id} log={log} />)
            )}
          </section>
        </div>
      ) : tab === "changes" ? (
        <ProjectChangeSessions projectId={project.id} sessions={changeSessions} />
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            板块进程表：大板块 → 子板块；提出时间取灵感与演进更早者；改进时间线 + 工时（聊天起止）。
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="text-slate-500">板块</span>
              <select
                className="mt-1 block min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={moduleFilter.l1}
                onChange={(e) =>
                  setModuleFilter({ l1: e.target.value, l2: "" })
                }
              >
                <option value="">
                  全部
                  {moduleStats.length > 0
                    ? `（${countForPaths(
                        moduleStats.map((s) => s.module),
                        moduleStats
                      )}）`
                    : ""}
                </option>
                {moduleTree.map(({ l1, l2 }) => {
                  const paths = modules.filter((m) => moduleMatchesPrefix(m, l1));
                  const n = countForPaths(paths, moduleStats);
                  return (
                    <option key={l1} value={l1}>
                      {l1}
                      {l2.length > 0 ? ` · ${l2.length} 子板块` : ""}
                      {n > 0 ? `（${n}）` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-500">子板块</span>
              <select
                className="mt-1 block min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                value={moduleFilter.l2}
                disabled={!moduleFilter.l1 || l2Options.length === 0}
                onChange={(e) =>
                  setModuleFilter((f) => ({ ...f, l2: e.target.value }))
                }
              >
                <option value="">
                  {!moduleFilter.l1
                    ? "先选板块"
                    : l2Options.length === 0
                      ? "无子板块"
                      : `全部子板块${(() => {
                          const paths = modules.filter((m) =>
                            moduleMatchesPrefix(m, moduleFilter.l1)
                          );
                          const n = countForPaths(paths, moduleStats);
                          return n > 0 ? `（${n}）` : "";
                        })()}`}
                </option>
                {l2Options.map((l2) => {
                  const prefix = `${moduleFilter.l1}·${l2}`;
                  const paths = modules.filter((m) =>
                    moduleMatchesPrefix(m, prefix)
                  );
                  const n = countForPaths(paths, moduleStats);
                  return (
                    <option key={l2} value={l2}>
                      {l2}
                      {n > 0 ? `（${n}）` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            {moduleFilter.l1 || moduleFilter.l2 ? (
              <button
                type="button"
                onClick={() => setModuleFilter({ l1: "", l2: "" })}
                className="mb-0.5 text-xs text-slate-500 hover:text-indigo-600"
              >
                清除筛选
              </button>
            ) : null}
          </div>

          <ModuleProgressTable
            modules={modules}
            evolution={evolution}
            ideas={ideas}
            changeSessions={changeSessions}
            pathPrefix={modulePathPrefix(moduleFilter)}
          />
        </div>
      )}

      <Link href="/evolution" className="inline-block text-sm text-indigo-600 hover:underline">
        查看全局演进记录 →
      </Link>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("tab-pill", active ? "tab-pill-active" : "tab-pill-idle")}
      style={
        active
          ? { backgroundColor: "#e0e7ff", color: "#312e81" }
          : { backgroundColor: "#ffffff", color: "#334155" }
      }
    >
      {children}
    </button>
  );
}

function ReleaseArticle({
  release,
  evolution,
  iterations,
  modulesForRelease,
}: {
  release: StudioRelease;
  evolution: EvolutionLog[];
  iterations: Iteration[];
  modulesForRelease: (tag: string, body?: string | null) => string[];
}) {
  const linkedEvo = evolution.filter((e) => e.releaseTag === release.tag);
  const linkedIter = iterations.filter((i) => i.release_tag === release.tag);
  const mods = modulesForRelease(release.tag, release.body);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-bold text-slate-900">{release.tag}</span>
        {release.name && release.name !== release.tag ? (
          <span className="text-sm text-slate-600">{release.name}</span>
        ) : null}
        <StudioBadge tone="muted">
          {release.source === "tag" ? "Tag" : "Release"}
        </StudioBadge>
        {release.isPrerelease ? <StudioBadge tone="muted">预发布</StudioBadge> : null}
        <span className="text-xs text-slate-400">{formatDate(release.publishedAt)}</span>
      </div>
      {mods.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {mods.map((m) => (
            <StudioBadge key={m}>{m}</StudioBadge>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-700">
          本版尚未关联板块。请用 MCP/站内写演进时填写板块，或发版时用 publish_release 汇总。
        </p>
      )}
      {(() => {
        // 优先：已挂本版的演进，按时间倒序；每条打方向标签（产品/体验/技术/交付）
        if (linkedEvo.length > 0) {
          const sorted = [...linkedEvo].sort((a, b) =>
            (b.createdAt || "").localeCompare(a.createdAt || "")
          );
          return (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500">本版更新内容</div>
              <ul className="mt-2 space-y-1.5">
                {sorted.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-wrap items-start gap-1.5 text-sm text-slate-700"
                  >
                    <StudioBadge tone="muted">
                      {inferChangeDirection(`${log.title} ${log.after ?? ""}`)}
                    </StudioBadge>
                    {log.module?.trim() ? (
                      <StudioBadge>{log.module.trim()}</StudioBadge>
                    ) : null}
                    <span className="min-w-0 flex-1">{log.title}</span>
                    {log.createdAt ? (
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {formatDate(log.createdAt)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        if (release.body?.trim()) {
          const items = extractReleaseBodyItems(release.body);
          return (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500">本版更新内容</div>
              <ul className="mt-2 space-y-1.5">
                {items.map((text, idx) => (
                  <li
                    key={`${idx}-${text.slice(0, 24)}`}
                    className="flex flex-wrap items-start gap-1.5 text-sm text-slate-700"
                  >
                    <StudioBadge tone="muted">{inferChangeDirection(text)}</StudioBadge>
                    <span className="min-w-0 flex-1">{text.replace(/^feat:\s*/i, "")}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <p className="mt-3 text-xs text-slate-500">
            暂无变更说明（无 Release body，且未能从 commits 推断）。
          </p>
        );
      })()}

      {release.htmlUrl ? (
        <a
          href={release.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
        >
          在 GitHub 打开 →
        </a>
      ) : null}
      {linkedIter.length > 0 ? (
        <div className="mt-3">
          <div className="text-xs font-medium text-slate-500">迭代计划</div>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {linkedIter.map((it) => (
              <li key={it.id}>
                {it.name}
                {it.start_date || it.end_date
                  ? ` · ${it.start_date ?? "?"} → ${it.end_date ?? "?"}`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function EvolutionCard({ log, compact }: { log: EvolutionLog; compact?: boolean }) {
  return (
    <article
      className={cn(
        "rounded-xl border border-slate-200 bg-white",
        compact ? "p-3" : "p-5"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StudioBadge>{EVOLUTION_TYPE_LABELS[log.logType]}</StudioBadge>
        {log.module ? <StudioBadge tone="muted">{log.module}</StudioBadge> : null}
        {log.releaseTag ? <StudioBadge tone="muted">{log.releaseTag}</StudioBadge> : null}
        <span className="text-xs text-slate-400">{formatDate(log.createdAt)}</span>
      </div>
      <h3 className={cn("font-bold text-slate-900", compact ? "mt-1 text-sm" : "mt-2 text-lg")}>
        {log.title}
      </h3>
      {!compact ? (
        <>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-xl bg-red-50 p-3">
              <div className="text-xs font-medium text-red-600">变化前</div>
              <p className="mt-1 text-slate-700">{log.before || "—"}</p>
            </div>
            <div className="rounded-xl bg-green-50 p-3">
              <div className="text-xs font-medium text-green-600">变化后</div>
              <p className="mt-1 text-slate-700">{log.after || "—"}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            <span className="text-slate-400">为什么：</span>
            {log.reason?.trim() ? (
              log.reason
            ) : (
              <span className="text-amber-700">未填写（建议补一句，方便以后追溯）</span>
            )}
          </p>
          {log.decision ? (
            <p className="mt-2 text-sm font-medium text-slate-800">
              <span className="font-normal text-slate-400">结论：</span>
              {log.decision}
            </p>
          ) : null}
        </>
      ) : log.after ? (
        <p className="mt-1 text-xs text-slate-600">{log.after}</p>
      ) : null}
    </article>
  );
}
