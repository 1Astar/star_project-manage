"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createWikiPageAction,
  deleteWikiPageAction,
} from "@/lib/actions";
import type { ProjectWikiPage, WikiPageHostKind } from "@/lib/types";

export function WikiPagesBlock({
  projectId,
  projectSlug,
  hostKind,
  hostKey,
  parentId = null,
  pages,
  canEdit,
  title = "子页面",
  emptyHint = "还没有子页面。可像 Notion 一样一层层往下建。",
  compact = false,
}: {
  projectId: string;
  projectSlug: string;
  hostKind: WikiPageHostKind;
  hostKey: string;
  parentId?: string | null;
  pages: ProjectWikiPage[];
  canEdit: boolean;
  title?: string;
  emptyHint?: string;
  /** Peek 内更紧凑 */
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function createPage() {
    const name = draft.trim();
    if (!name) return;
    setError(null);
    setCreating(true);
    try {
      const page = await createWikiPageAction({
        projectId,
        projectSlug,
        title: name,
        hostKind,
        hostKey,
        parentId,
      });
      setDraft("");
      startTransition(() => {
        router.push(`/projects/${projectSlug}/pages/${page.id}`);
        router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function removePage(pageId: string) {
    if (!confirm("删除此页及其全部子页？")) return;
    setError(null);
    try {
      await deleteWikiPageAction({ pageId, projectSlug });
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <section
      className={
        compact
          ? "space-y-2"
          : "rounded-xl border border-slate-200 bg-white p-4"
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3
          className={
            compact
              ? "text-xs font-semibold text-slate-700"
              : "text-sm font-semibold text-slate-900"
          }
        >
          {title}
        </h3>
        <span className="text-[11px] text-slate-400">{pages.length}</span>
      </div>

      {pages.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyHint}</p>
      ) : (
        <ul className="space-y-1">
          {pages.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
            >
              <Link
                href={`/projects/${projectSlug}/pages/${p.id}`}
                className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-medium text-slate-800 hover:text-indigo-700"
              >
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-[10px] text-slate-400"
                  aria-hidden
                >
                  📄
                </span>
                <span className="truncate">{p.title || "无标题"}</span>
              </Link>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => void removePage(p.id)}
                  className="shrink-0 text-[11px] text-slate-400 hover:text-red-600"
                >
                  删
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createPage();
              }
            }}
            placeholder="新子页面标题…"
            className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => void createPage()}
            disabled={!draft.trim() || creating || pending}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {creating ? "创建中…" : "新建子页"}
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
