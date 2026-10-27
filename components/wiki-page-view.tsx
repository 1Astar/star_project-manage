"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { PageFloatingToc } from "@/components/page-floating-toc";
import { PagePropertyRows } from "@/components/page-property-rows";
import { MarkdownWithLinkedViews } from "@/components/markdown-with-linked-views";
import { useLinkedViewPeek } from "@/components/use-linked-view-peek";
import { WikiPagesBlock } from "@/components/wiki-pages-block";
import { InvestigationAiPanel } from "@/components/investigation-ai-panel";
import {
  collectModuleNames,
  collectModuleTree,
  type LinkedViewLibraryRows,
} from "@/lib/linked-views/build-libraries";
import { updateWikiPageAction } from "@/lib/actions";
import { joinPageProps, splitPageProps } from "@/lib/wiki-pages/page-props";
import { encodeModuleKey } from "@/lib/modules/product-module-home";
import {
  extractMarkdownOutline,
  mergeOutline,
  type OutlineItem,
} from "@/lib/wiki-pages/outline";
import type { ProjectWikiPage } from "@/lib/types";

export function WikiPageView({
  projectId,
  projectSlug,
  page: initial,
  ancestors,
  childPages,
  canEdit,
  libraries,
}: {
  projectId: string;
  projectSlug: string;
  page: ProjectWikiPage;
  ancestors: ProjectWikiPage[];
  childPages: ProjectWikiPage[];
  canEdit: boolean;
  libraries: LinkedViewLibraryRows;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [page, setPage] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultModuleName =
    page.host_kind === "module" ? page.host_key : undefined;
  const moduleExtras = defaultModuleName ? [defaultModuleName] : [];
  const moduleTree = useMemo(
    () => collectModuleTree(libraries, moduleExtras),
    [libraries, defaultModuleName]
  );
  const moduleOptions = useMemo(
    () => collectModuleNames(libraries, moduleExtras),
    [libraries, defaultModuleName]
  );
  const { openRow, peekNode, peekError } = useLinkedViewPeek(projectSlug, canEdit, {
    projectId,
    moduleOptions,
    moduleTree,
  });

  useEffect(() => {
    setPage(initial);
    setTitle(initial.title);
    setBody(initial.body);
    setEditing(false);
  }, [initial]);

  const dirty = title !== page.title || body !== page.body;
  const { props: pageProps, markdown } = splitPageProps(editing || dirty ? body : page.body);
  const parentPage = ancestors.length > 1 ? ancestors[ancestors.length - 2] : null;

  const outline = useMemo((): OutlineItem[] => {
    const source = splitPageProps(editing || dirty ? body : page.body).markdown;
    return mergeOutline(extractMarkdownOutline(source), {
      id: "wiki-child-pages",
      text: "子页面",
      level: 2,
    });
  }, [body, page.body, editing, dirty]);

  async function save() {
    if (!canEdit || !dirty) return;
    setError(null);
    setSaved(false);
    try {
      const next = await updateWikiPageAction({
        pageId: page.id,
        projectSlug,
        title,
        body,
      });
      setPage(next);
      setSaved(true);
      setEditing(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  const moduleHref =
    page.host_kind === "module"
      ? `/projects/${projectSlug}/modules/${encodeModuleKey(page.host_key)}`
      : null;

  const displayBody = splitPageProps(editing ? body : page.body).markdown.trim();

  return (
    <div className="relative xl:pr-48">
      <PageFloatingToc items={outline} />

      <div className="mx-auto max-w-3xl space-y-4">
        <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
          {moduleHref ? (
            <>
              <Link href={moduleHref} className="text-indigo-600 hover:underline">
                {page.host_key}
              </Link>
              <span>/</span>
            </>
          ) : (
            <>
              <Link
                href={`/projects/${projectSlug}/overview`}
                className="text-indigo-600 hover:underline"
              >
                总览
              </Link>
              <span>/</span>
              <span className="text-slate-500">{page.host_kind}</span>
              <span>/</span>
            </>
          )}
          {ancestors.slice(0, -1).map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1">
              <Link
                href={`/projects/${projectSlug}/pages/${a.id}`}
                className="text-indigo-600 hover:underline"
              >
                {a.title || "无标题"}
              </Link>
              <span>/</span>
            </span>
          ))}
          <span className="text-slate-600">{page.title || "无标题"}</span>
          {pending ? <span className="ml-2">刷新中…</span> : null}
        </nav>

        <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          {canEdit ? (
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setSaved(false);
                setEditing(true);
              }}
              className="w-full border-0 bg-transparent text-2xl font-semibold text-slate-900 outline-none"
              placeholder="页面标题"
            />
          ) : (
            <h1 className="text-2xl font-semibold text-slate-900">
              {page.title || "无标题"}
            </h1>
          )}
          <PagePropertyRows
            projectSlug={projectSlug}
            props={pageProps}
            parent={parentPage}
            children={childPages}
            canEdit={canEdit}
            onChange={
              canEdit
                ? (next) => {
                    setBody(joinPageProps(next, markdown));
                    setSaved(false);
                    setEditing(true);
                  }
                : undefined
            }
          />
          {displayBody || canEdit ? (
            <MarkdownWithLinkedViews
              content={markdown}
              projectId={projectId}
              projectSlug={projectSlug}
              libraries={libraries}
              canEdit={canEdit}
              editing={canEdit}
              defaultModuleName={defaultModuleName}
              moduleOptions={moduleOptions}
              onChange={
                canEdit
                  ? (next) => {
                      setBody(joinPageProps(pageProps, next));
                      setSaved(false);
                      setEditing(true);
                    }
                  : undefined
              }
              onOpenRow={openRow}
            />
          ) : (
            <p className="text-sm text-slate-400">暂无正文。</p>
          )}
          {canEdit ? (
            <InvestigationAiPanel
              pageTitle={title}
              moduleName={defaultModuleName}
              body={body}
              canEdit={canEdit}
              onApplyBody={(next) => {
                setBody(next);
                setSaved(false);
                setEditing(true);
              }}
            />
          ) : null}
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                保存
              </button>
              {dirty ? (
                <button
                  type="button"
                  onClick={() => {
                    setTitle(page.title);
                    setBody(page.body);
                    setEditing(false);
                    setSaved(false);
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                >
                  取消
                </button>
              ) : null}
              {saved ? (
                <span className="text-xs text-emerald-600">已保存</span>
              ) : null}
              {error || peekError ? (
                <span className="text-xs text-red-600">{error || peekError}</span>
              ) : null}
            </div>
          ) : null}
        </article>

        {peekError ? (
          <p className="text-xs text-red-600">{peekError}</p>
        ) : null}
        {peekNode}

        <div id="wiki-child-pages" className="scroll-mt-24">
          <WikiPagesBlock
            projectId={projectId}
            projectSlug={projectSlug}
            hostKind={page.host_kind}
            hostKey={page.host_key}
            parentId={page.id}
            pages={childPages}
            canEdit={canEdit}
            title="子页面"
            emptyHint="在这层下面再建子页，像 Notion 一样一层层展开；也可在正文用 Markdown 链接跳到相关页。"
          />
        </div>
      </div>
    </div>
  );
}
