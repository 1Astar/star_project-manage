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
    <div className="relative xl:pr-48">
      <PageFloatingToc items={outline} />

      <div className={`mx-auto space-y-6 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
        <header className="space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {title}
            </h1>
            {canEdit && studioProjectId ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
                  {(
                    [
                      ["page", "页面"],
                      ["markdown", "Markdown"],
                      ["split", "对照"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPane(id)}
                      className={`rounded-md px-2.5 py-1 ${
                        pane === id
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void persist(true)}
                  disabled={!dirty || saving}
                  className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
                >
                  {saving ? "保存中…" : "保存"}
                </button>
              </div>
            ) : null}
          </div>
          <p className="text-xs text-slate-400">
            项目 Hub · 页面里直接改，会写回 Markdown
            {isDefault && !savedMd ? " · 当前为默认骨架，保存后固化" : ""}
            {saved && !dirty ? " · 已保存" : dirty ? " · 未保存" : ""}
            {pending ? " · 刷新中…" : ""}
          </p>
          {error || peekError ? (
            <p className="text-xs text-red-600">{error || peekError}</p>
          ) : null}
        </header>

        <div
          className={
            pane === "split"
              ? "grid gap-3 lg:grid-cols-2"
              : "space-y-3"
          }
        >
          {showPage ? (
            <article className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
              {pane === "split" ? (
                <p className="mb-3 text-[11px] text-slate-400">页面</p>
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
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              {pane === "split" ? (
                <p className="mb-2 text-[11px] text-slate-400">Markdown</p>
              ) : null}
              {canEdit && studioProjectId ? (
                <textarea
                  value={md}
                  onChange={(e) => onMdChange(e.target.value)}
                  rows={pane === "split" ? 22 : 24}
                  className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-[13px] leading-relaxed text-slate-800"
                  placeholder="用 ## 写章节。关联视图会写成 ```star-view 围栏。"
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

        <section
          id="hub-module-nav"
          className="scroll-mt-24 space-y-3 rounded-xl border border-slate-200 bg-white p-5"
        >
          <h2 className="text-lg font-semibold text-slate-900">模块导航</h2>
          <p className="text-xs text-slate-500">
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
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-800 hover:bg-slate-50 hover:text-indigo-700"
                  >
                    <span
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-[10px] text-slate-400"
                      aria-hidden
                    >
                      📄
                    </span>
                    <span className="font-medium">{m.name}</span>
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
            className="inline-block text-xs text-indigo-600 hover:underline"
          >
            查看全部模块 →
          </Link>
        </section>

        {workLinks.length > 0 ? (
          <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3">
            <p className="mb-2 text-[11px] font-medium text-slate-400">快捷入口</p>
            <div className="flex flex-wrap gap-2">
              {workLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
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
