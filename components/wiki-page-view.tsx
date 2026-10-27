"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { PageFloatingToc } from "@/components/page-floating-toc";
import { MarkdownPreview } from "@/components/studio/markdown-preview";
import { WikiPagesBlock } from "@/components/wiki-pages-block";
import { updateWikiPageAction } from "@/lib/actions";
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
}: {
  projectId: string;
  projectSlug: string;
  page: ProjectWikiPage;
  ancestors: ProjectWikiPage[];
  childPages: ProjectWikiPage[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [page, setPage] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(initial);
    setTitle(initial.title);
    setBody(initial.body);
    setEditing(false);
  }, [initial]);

  const dirty = title !== page.title || body !== page.body;

  const outline = useMemo((): OutlineItem[] => {
    const source = editing || dirty ? body : page.body;
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

  const displayBody = (editing ? body : page.body).trim();

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
          {canEdit && editing ? (
            <>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setSaved(false);
                }}
                className="w-full border-0 border-b border-transparent bg-transparent text-2xl font-semibold text-slate-900 outline-none focus:border-slate-200"
                placeholder="页面标题"
              />
              <textarea
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  setSaved(false);
                }}
                rows={18}
                placeholder={
                  "正文支持 Markdown。\n\n## 项目定位\n…\n\n## 模块导航\n用下方「子页面」挂相关页，或写链接：\n[文件管理](/projects/.../modules/...)\n"
                }
                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed text-slate-800"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={!dirty}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  保存
                </button>
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
                {saved ? (
                  <span className="text-xs text-emerald-600">已保存</span>
                ) : null}
                {error ? (
                  <span className="text-xs text-red-600">{error}</span>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">
                  {page.title || "无标题"}
                </h1>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    编辑
                  </button>
                ) : null}
              </div>
              {displayBody ? (
                <MarkdownPreview
                  content={displayBody}
                  withHeadingIds
                  preferInAppLinks
                />
              ) : (
                <p className="text-sm text-slate-400">
                  暂无正文。
                  {canEdit ? "点右上角编辑，用 ## 标题写章节，右侧会出现大纲。" : ""}
                </p>
              )}
            </>
          )}
        </article>

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
