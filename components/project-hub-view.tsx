"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PageFloatingToc } from "@/components/page-floating-toc";
import { MarkdownWithLinkedViews } from "@/components/markdown-with-linked-views";
import { useLinkedViewPeek } from "@/components/use-linked-view-peek";
import { saveProjectHubAction } from "@/lib/actions";
import {
  collectModuleNames,
  collectModuleTree,
  type LinkedViewLibraryRows,
} from "@/lib/linked-views/build-libraries";
import type { ProductModuleSummary } from "@/lib/modules/product-module-home";
import { encodeModuleKey } from "@/lib/modules/product-module-home";
import {
  extractMarkdownOutline,
  mergeOutline,
} from "@/lib/wiki-pages/outline";

export function ProjectHubView({
  projectId,
  projectSlug,
  studioProjectId,
  title,
  initialMd,
  isDefault,
  modules,
  canEdit,
  workLinks,
  libraries,
}: {
  projectId?: string | null;
  projectSlug: string;
  studioProjectId: string | null;
  title: string;
  initialMd: string;
  isDefault: boolean;
  modules: ProductModuleSummary[];
  canEdit: boolean;
  workLinks: Array<{ label: string; href: string }>;
  libraries: LinkedViewLibraryRows;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [md, setMd] = useState(initialMd);
  const [savedMd, setSavedMd] = useState(isDefault ? "" : initialMd);
  const [pane, setPane] = useState<"page" | "markdown" | "split">("page");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const moduleTree = useMemo(
    () => collectModuleTree(libraries, modules.map((m) => m.name)),
    [libraries, modules]
  );
  const moduleOptions = useMemo(
    () => collectModuleNames(libraries, modules.map((m) => m.name)),
    [libraries, modules]
  );
  const { openRow, peekNode, peekError } = useLinkedViewPeek(projectSlug, canEdit, {
    projectId: projectId ?? undefined,
    moduleOptions,
    moduleTree,
  });

  const mdRef = useRef(md);
  mdRef.current = md;
  const dirty = md !== (savedMd || initialMd);

  useEffect(() => {
    if (dirty) return;
    setMd(initialMd);
    setSavedMd(isDefault ? "" : initialMd);
  }, [initialMd, isDefault, dirty]);

  const outline = useMemo(
    () =>
      mergeOutline(extractMarkdownOutline(md), {
        id: "hub-module-nav",
        text: "模块导航",
        level: 2,
      }),
    [md]
  );

  async function persist(refresh = false) {
    if (!canEdit || !studioProjectId || saving) return;
    const snapshot = mdRef.current;
    setError(null);
    setSaving(true);
    try {
      await saveProjectHubAction({
        studioProjectId,
        projectSlug,
        markdown: snapshot,
      });
      if (mdRef.current === snapshot) {
        setSavedMd(snapshot);
        setSaved(true);
      }
      if (refresh) startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!canEdit || !studioProjectId || !dirty || saving) return;
    const t = window.setTimeout(() => {
      void persist(false);
    }, 900);
    return () => window.clearTimeout(t);
    // 仅随正文变化自动保存
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [md, dirty, canEdit, studioProjectId, saving]);

  const showPage = pane === "page" || pane === "split";
  const showSource = pane === "markdown" || pane === "split";
  const wide = pane === "split";

  function onMdChange(next: string) {
    setMd(next);
    setSaved(false);
  }

  return (
    <div className="relative">
      <PageFloatingToc items={outline} />

      <div
        className={`mx-auto px-1 sm:px-2 ${wide ? "max-w-6xl" : "max-w-[720px]"}`}
      >
        <header className="mb-8 space-y-3 pt-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-[2.25rem]">
              {title}
            </h1>
            {canEdit && studioProjectId ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {(
                  [
                    ["page", "页面"],
                    ["markdown", "源码"],
                    ["split", "对照"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPane(id)}
                    className={`rounded-md px-2 py-1 text-[11px] ${
                      pane === id
                        ? "bg-slate-100 font-medium text-slate-800"
                        : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void persist(true)}
                  disabled={!dirty || saving}
                  className="ml-1 rounded-md px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-30"
                >
                  {saving ? "保存中…" : dirty ? "保存" : "已保存"}
                </button>
              </div>
            ) : null}
          </div>
          <p className="text-xs text-slate-400">
            {isDefault && !savedMd
              ? "默认骨架 · 页面看渲染，点段落可改；编辑后自动保存"
              : "页面看渲染，点段落可改；自动写回 Markdown"}
            {saved && !dirty ? " · 已同步" : dirty ? " · 未保存" : ""}
            {pending ? " · 刷新中…" : ""}
          </p>
          {error || peekError ? (
            <p className="text-xs text-red-600">{error || peekError}</p>
          ) : null}
        </header>

        <div
          className={
            pane === "split" ? "grid gap-8 lg:grid-cols-2" : "space-y-1"
          }
        >
          {showPage ? (
            <article className="min-w-0">
              {pane === "split" ? (
                <p className="mb-2 text-[11px] text-slate-400">页面</p>
              ) : null}
              <MarkdownWithLinkedViews
                content={md}
                projectId={projectId ?? undefined}
                projectSlug={projectSlug}
                libraries={libraries}
                canEdit={canEdit && Boolean(studioProjectId)}
                editing={canEdit && Boolean(studioProjectId)}
                moduleOptions={moduleOptions}
                onChange={
                  canEdit && studioProjectId ? onMdChange : undefined
                }
                onOpenRow={openRow}
              />
            </article>
          ) : null}
          {showSource ? (
            <section className="min-w-0">
              {pane === "split" ? (
                <p className="mb-2 text-[11px] text-slate-400">Markdown</p>
              ) : null}
              {canEdit && studioProjectId ? (
                <textarea
                  value={md}
                  onChange={(e) => onMdChange(e.target.value)}
                  rows={pane === "split" ? 22 : 28}
                  className="w-full resize-y border-0 bg-transparent px-0 py-1 font-mono text-[13px] leading-relaxed text-slate-800 outline-none ring-0 placeholder:text-slate-300"
                  placeholder="用 ## 写章节。关联视图写成 ```star-view 围栏。"
                />
              ) : (
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[13px] text-slate-700">
                  {md}
                </pre>
              )}
            </section>
          ) : null}
        </div>

        {peekNode}

        <section id="hub-module-nav" className="mt-12 scroll-mt-24 space-y-3 border-t border-slate-100 pt-8">
          <h2 className="text-xl font-semibold text-slate-900">模块导航</h2>
          <p className="text-sm text-slate-500">
            点进模块主页查看简介、功能拆解子页与关联条目。
          </p>
          {modules.length === 0 ? (
            <p className="text-sm text-slate-400">
              还没有模块。可在项目设置配置功能板块，或先在学习池建「板块」。
            </p>
          ) : (
            <ul className="space-y-0.5">
              {modules.map((m) => (
                <li key={m.key}>
                  <Link
                    href={`/projects/${projectSlug}/modules/${encodeModuleKey(m.name)}`}
                    className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                  >
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[13px] text-slate-400"
                      aria-hidden
                    >
                      📄
                    </span>
                    <span className="font-medium group-hover:text-indigo-700">
                      {m.name}
                    </span>
                    {m.bio.trim() ? (
                      <span className="truncate text-xs text-slate-400">
                        {m.bio.trim().slice(0, 48)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/projects/${projectSlug}/modules`}
            className="inline-block text-sm text-slate-500 hover:text-indigo-600"
          >
            查看全部模块 →
          </Link>
        </section>

        {workLinks.length > 0 ? (
          <section className="mt-8 space-y-2 pb-10">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              快捷入口
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {workLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-sm text-slate-600 underline-offset-2 hover:text-indigo-700 hover:underline"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
