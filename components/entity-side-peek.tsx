"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export type EntityPeekKind = "learning" | "bug" | "competitor" | "requirement";

export type EntityPeekField = {
  key: string;
  label: string;
  value: string;
  /** 可编辑的多行 */
  multiline?: boolean;
};

export type EntityPeekPayload = {
  kind: EntityPeekKind;
  id: string;
  title: string;
  href?: string;
  badge?: string;
  fields?: EntityPeekField[];
};

const KIND_LABEL: Record<EntityPeekKind, string> = {
  learning: "学习",
  bug: "Bug",
  competitor: "竞品",
  requirement: "需求",
};

/**
 * 关联条目 Side Peek。
 * - overlay：浮层 + 蒙层（详情页等默认）
 * - panel：分栏嵌入，不遮挡左侧内容（调研总览对齐 Notion）
 */
export function EntitySidePeek({
  item,
  pending = false,
  onClose,
  onSave,
  variant = "overlay",
  children,
}: {
  item: EntityPeekPayload;
  pending?: boolean;
  onClose: () => void;
  onSave?: (patch: {
    title: string;
    fields: Record<string, string>;
  }) => void | Promise<void>;
  variant?: "overlay" | "panel";
  /** 面板底部扩展区（如关联表） */
  children?: ReactNode;
}) {
  const [title, setTitle] = useState(item.title);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of item.fields ?? []) init[f.key] = f.value ?? "";
    return init;
  });
  const editable = Boolean(onSave);
  const isPanel = variant === "panel";

  useEffect(() => {
    setTitle(item.title);
    const init: Record<string, string> = {};
    for (const f of item.fields ?? []) init[f.key] = f.value ?? "";
    setValues(init);
  }, [item]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const body = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-1.5 py-1 text-slate-500 hover:bg-slate-100"
            title="收起侧栏"
            aria-label="收起侧栏"
          >
            ≫
          </button>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
            {KIND_LABEL[item.kind]}
            {item.badge ? ` · ${item.badge}` : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.href ? (
            <Link
              href={item.href}
              className="rounded-md px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
              title="全屏打开"
            >
              ↗
            </Link>
          ) : null}
          {editable ? (
            <button
              type="button"
              disabled={pending || !title.trim()}
              onClick={() => onSave?.({ title: title.trim(), fields: values })}
              className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              {pending ? "保存中…" : "保存"}
            </button>
          ) : null}
          {!isPanel ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              关闭
            </button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {editable ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border-0 bg-transparent text-xl font-semibold text-slate-900 outline-none"
          />
        ) : (
          <h2 className="text-xl font-semibold text-slate-900">{item.title}</h2>
        )}
        {(item.fields ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">
            {editable ? "暂无更多字段。" : "点右上角打开完整页。"}
          </p>
        ) : (
          <dl className="space-y-3">
            {(item.fields ?? []).map((f) => (
              <div
                key={f.key}
                className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[7.5rem_minmax(0,1fr)]"
              >
                <dt className="pt-1.5 text-xs font-medium text-slate-500">
                  {f.label}
                </dt>
                <dd className="min-w-0">
                  {editable ? (
                    f.multiline ? (
                      <textarea
                        value={values[f.key] ?? ""}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [f.key]: e.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full resize-y rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-800"
                      />
                    ) : (
                      <input
                        value={values[f.key] ?? ""}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [f.key]: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800"
                      />
                    )
                  ) : (
                    <span className="whitespace-pre-wrap text-sm text-slate-800">
                      {f.value || "—"}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {children ? (
          <div className="border-t border-slate-100 pt-4">{children}</div>
        ) : null}
      </div>
    </>
  );

  if (isPanel) {
    return (
      <aside className="flex h-full min-h-0 w-full flex-col border-l border-slate-200 bg-white">
        {body}
      </aside>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="关闭侧栏"
        className="fixed inset-0 z-40 bg-slate-900/20"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl">
        {body}
      </aside>
    </>
  );
}
