"use client";

import Link from "next/link";
import { useState } from "react";

export type CrossLinkOption = {
  id: string;
  title: string;
  href?: string;
};

/** 通用：已关联列表 + 下拉挂上 / 取消 */
export function CrossLinkSection({
  title,
  emptyHint,
  linkedIds,
  options,
  pending = false,
  pickPlaceholder = "选择要关联的条目…",
  onLink,
  onUnlink,
}: {
  title: string;
  emptyHint?: string;
  linkedIds: string[];
  options: CrossLinkOption[];
  pending?: boolean;
  pickPlaceholder?: string;
  onLink: (id: string) => void;
  onUnlink: (id: string) => void;
}) {
  const [pick, setPick] = useState("");
  const byId = new Map(options.map((o) => [o.id, o]));
  const linkable = options.filter((o) => !linkedIds.includes(o.id));

  return (
    <section className="space-y-2 border-t border-slate-100 pt-3">
      <h4 className="text-xs font-semibold text-slate-500">{title}</h4>
      {linkedIds.length === 0 ? (
        <p className="text-xs text-slate-400">
          {emptyHint ?? "尚未关联。可从下方选择。"}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {linkedIds.map((id) => {
            const opt = byId.get(id);
            const label = opt?.title ?? id;
            const href = opt?.href;
            return (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
              >
                {href ? (
                  <Link
                    href={href}
                    className="min-w-0 flex-1 text-indigo-700 hover:underline"
                  >
                    {label}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 text-slate-800">{label}</span>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onUnlink(id)}
                  className="shrink-0 text-xs text-slate-500 hover:text-red-600"
                >
                  取消关联
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">{pickPlaceholder}</option>
          {linkable.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || !pick}
          onClick={() => {
            onLink(pick);
            setPick("");
          }}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
        >
          挂上
        </button>
      </div>
    </section>
  );
}
