"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { PageFloatingToc } from "@/components/page-floating-toc";
import { MarkdownPreview } from "@/components/studio/markdown-preview";
import { saveProjectHubAction } from "@/lib/actions";
import type { ProductModuleSummary } from "@/lib/modules/product-module-home";
import { encodeModuleKey } from "@/lib/modules/product-module-home";
import {
  extractMarkdownOutline,
  mergeOutline,
} from "@/lib/wiki-pages/outline";

export function ProjectHubView({
  projectSlug,
  studioProjectId,
  title,
  initialMd,
  isDefault,
  modules,
  canEdit,
  workLinks,
}: {
  projectSlug: string;
  studioProjectId: string | null;
  title: string;
  initialMd: string;
  isDefault: boolean;
  modules: ProductModuleSummary[];
  canEdit: boolean;
  workLinks: Array<{ label: string; href: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [md, setMd] = useState(initialMd);
  const [savedMd, setSavedMd] = useState(isDefault ? "" : initialMd);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMd(initialMd);
    setSavedMd(isDefault ? "" : initialMd);
    setEditing(false);
  }, [initialMd, isDefault]);

  const dirty = md !== (savedMd || initialMd);

  const outline = useMemo(
    () =>
      mergeOutline(extractMarkdownOutline(md), {
        id: "hub-module-nav",
        text: "模块导航",
        level: 2,
      }),
    [md]
  );

  async function save() {
    if (!canEdit || !studioProjectId) return;
    setError(null);
    setSaved(false);
    try {
      await saveProjectHubAction({
        studioProjectId,
        projectSlug,
        markdown: md,
      });
      setSavedMd(md);
      setSaved(true);
      setEditing(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }

  return (
    <div className="relative xl:pr-48">
      <PageFloatingToc items={outline} />

      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              {title}
            </h1>
            {canEdit && studioProjectId ? (
              <button
                type="button"
                onClick={() => {
                  if (editing) {
                    setMd(savedMd || initialMd);
                    setEditing(false);
                  } else {
                    setEditing(true);
                  }
                }}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                {editing ? "取消编辑" : "编辑 Hub"}
              </button>
            ) : null}
          </div>
          <p className="text-xs text-slate-400">
            项目 Hub · 从这里进模块与调研
            {isDefault && !savedMd ? " · 当前为默认骨架，保存后固化" : ""}
            {pending ? " · 刷新中…" : ""}
          </p>
        </header>

        {editing && canEdit && studioProjectId ? (
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <textarea
              value={md}
              onChange={(e) => {
                setMd(e.target.value);
                setSaved(false);
              }}
              rows={22}
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-[13px] leading-relaxed text-slate-800"
              placeholder="用 ## 写章节；模块导航在下方自动列出，不必手写模块链接。"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                保存 Hub
              </button>
              {saved ? (
                <span className="text-xs text-emerald-600">已保存</span>
              ) : null}
              {error ? <span className="text-xs text-red-600">{error}</span> : null}
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
              <p className="mb-2 text-[11px] text-slate-400">预览</p>
              <MarkdownPreview content={md} withHeadingIds preferInAppLinks />
            </div>
          </section>
        ) : (
          <article className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <MarkdownPreview content={md} withHeadingIds preferInAppLinks />
          </article>
        )}

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
