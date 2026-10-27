"use client";

import Link from "next/link";
import {
  WIKI_PAGE_STATUSES,
  type WikiPageProps,
} from "@/lib/wiki-pages/page-props";
import type { ProjectWikiPage } from "@/lib/types";

export function PagePropertyRows({
  projectSlug,
  props,
  parent,
  children,
  canEdit = false,
  onChange,
}: {
  projectSlug: string;
  props: WikiPageProps;
  parent?: { id: string; title: string } | null;
  children?: ProjectWikiPage[];
  canEdit?: boolean;
  onChange?: (next: WikiPageProps) => void;
}) {
  const kids = children ?? [];
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
        <dt className="text-[11px] font-medium text-slate-400">状态</dt>
        <dd>
          {canEdit && onChange ? (
            <select
              value={props.status}
              onChange={(e) =>
                onChange({ ...props, status: e.target.value as WikiPageProps["status"] })
              }
              className="rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm text-slate-800 hover:border-slate-200"
            >
              <option value="">空</option>
              {WIKI_PAGE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-slate-700">{props.status || "空"}</span>
          )}
        </dd>
      </div>
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
        <dt className="text-[11px] font-medium text-slate-400">核心能力</dt>
        <dd>
          {canEdit && onChange ? (
            <input
              value={props.capability}
              onChange={(e) => onChange({ ...props, capability: e.target.value })}
              placeholder="例如：核心能力"
              className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm text-slate-800 outline-none hover:border-slate-200"
            />
          ) : (
            <span className="text-slate-700">{props.capability || "空"}</span>
          )}
        </dd>
      </div>
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-2">
        <dt className="pt-0.5 text-[11px] font-medium text-slate-400">
          上级·子级
        </dt>
        <dd className="min-w-0 text-slate-700">
          {parent ? (
            <Link
              href={`/projects/${projectSlug}/pages/${parent.id}`}
              className="text-indigo-700 hover:underline"
            >
              {parent.title || "无标题"}
            </Link>
          ) : (
            <span className="text-slate-400">无上级</span>
          )}
          <span className="mx-1 text-slate-300">·</span>
          {kids.length === 0 ? (
            <span className="text-slate-400">无子级</span>
          ) : (
            <span className="inline-flex flex-wrap gap-x-2 gap-y-1">
              {kids.map((c) => (
                <Link
                  key={c.id}
                  href={`/projects/${projectSlug}/pages/${c.id}`}
                  className="text-indigo-700 hover:underline"
                >
                  {c.title || "无标题"}
                </Link>
              ))}
            </span>
          )}
        </dd>
      </div>
    </dl>
  );
}
