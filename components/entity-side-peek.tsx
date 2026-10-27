"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  joinModulePath,
  splitModulePath,
  withPartitionTag,
  type LinkedViewModuleChoice,
} from "@/lib/linked-views/module-path";
import { optimizeLinkedViewTitleAction } from "@/lib/linked-views/actions";
import {
  applyPartitionToTitle,
  parseTitleModulePrefix,
  titleUsesModulePrefix,
} from "@/lib/linked-views/title-hints";

export type EntityPeekKind =
  | "learning"
  | "bug"
  | "competitor"
  | "requirement"
  | "prd";

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
  titlePlaceholder?: string;
  titleHint?: string;
  moduleOptions?: string[];
  moduleTree?: LinkedViewModuleChoice[];
  fields?: EntityPeekField[];
};

const HIDDEN_FIELD_KEYS = new Set(["module_path", "module", "partition", "tags"]);

const KIND_LABEL: Record<EntityPeekKind, string> = {
  learning: "学习",
  bug: "Bug",
  competitor: "竞品",
  requirement: "需求",
  prd: "PRD",
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
  const [optimizePending, setOptimizePending] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of item.fields ?? []) init[f.key] = f.value ?? "";
    return init;
  });
  const editable = Boolean(onSave);
  const isPanel = variant === "panel";
  const prefixKind = titleUsesModulePrefix(item.kind);
  const split = splitModulePath(values.module_path ?? values.module ?? "");
  const l1 = split.l1;
  const l2 = (values.partition ?? split.l2).trim();
  const extraFields = (item.fields ?? []).filter(
    (f) => !HIDDEN_FIELD_KEYS.has(f.key)
  );
  const moduleChoices = useMemo(() => {
    const set = new Set<string>();
    for (const m of item.moduleTree ?? []) {
      if (m.name.trim()) set.add(m.name.trim());
    }
    for (const m of item.moduleOptions ?? []) {
      if (m.trim()) set.add(m.trim());
    }
    if (l1) set.add(l1);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh"));
  }, [item.moduleTree, item.moduleOptions, l1]);
  const partitionChoices = useMemo(() => {
    const hit = (item.moduleTree ?? []).find((m) => m.name.trim() === l1);
    const set = new Set((hit?.partitions ?? []).map((p) => p.trim()).filter(Boolean));
    if (l2) set.add(l2);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh"));
  }, [item.moduleTree, l1, l2]);

  function patchModule(nextL1: string, nextL2: string, nextTags?: string) {
    setValues((prev) => ({
      ...prev,
      module_path: joinModulePath(nextL1, nextL2),
      module: nextL1,
      partition: nextL2,
      tags: nextTags ?? prev.tags ?? "",
    }));
  }

  function setModule(next: string) {
    patchModule(next, "");
    if (prefixKind) {
      setTitle((prev) => applyPartitionToTitle(item.kind, prev, next, ""));
    }
  }

  function setPartition(next: string) {
    const tagged = next.trim()
      ? withPartitionTag(values.tags ?? "", next)
      : values.tags ?? "";
    patchModule(l1, next, tagged);
    if (prefixKind) {
      setTitle((prev) => applyPartitionToTitle(item.kind, prev, l1, next));
    }
  }

  function onTitleTyped(next: string) {
    setTitle(next);
    const parsed = parseTitleModulePrefix(item.kind, next);
    if (!parsed.l2) return;
    const tagged = withPartitionTag(values.tags ?? "", parsed.l2);
    patchModule(parsed.l1 || l1, parsed.l2, tagged);
  }

  async function optimizeTitle() {
    if (optimizePending) return;
    setOptimizePending(true);
    setOptimizeError(null);
    const context = extraFields
      .map((f) => `${f.label}：${values[f.key] ?? f.value ?? ""}`.trim())
      .filter((line) => !line.endsWith("："))
      .join("\n");
    try {
      const next = await optimizeLinkedViewTitleAction({
        kind: item.kind,
        title,
        l1,
        l2,
        context,
      });
      setTitle(next.title);
      const tagged = next.l2
        ? withPartitionTag(values.tags ?? "", next.l2)
        : values.tags ?? "";
      patchModule(next.l1, next.l2, tagged);
    } catch (e) {
      setOptimizeError(e instanceof Error ? e.message : "优化失败");
    } finally {
      setOptimizePending(false);
    }
  }

  useEffect(() => {
    setTitle(item.title);
    const init: Record<string, string> = {};
    for (const f of item.fields ?? []) init[f.key] = f.value ?? "";
    const parsed = parseTitleModulePrefix(item.kind, item.title);
    if (parsed.l2) {
      const l1Seed =
        parsed.l1 || splitModulePath(init.module_path ?? init.module ?? "").l1;
      init.partition = parsed.l2;
      init.module_path = joinModulePath(l1Seed, parsed.l2);
      if (parsed.l1) init.module = parsed.l1;
      init.tags = withPartitionTag(init.tags ?? "", parsed.l2);
    }
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
          <div>
            <div className="flex items-start gap-2">
              <input
                value={title}
                onChange={(e) => onTitleTyped(e.target.value)}
                placeholder={item.titlePlaceholder || "名称"}
                className="min-w-0 flex-1 border-0 bg-transparent text-xl font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-300"
              />
              <button
                type="button"
                disabled={optimizePending}
                onClick={() => void optimizeTitle()}
                className="mt-1 shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                title="按命名规范整理标题"
              >
                {optimizePending ? "优化中…" : "AI 优化"}
              </button>
            </div>
            {item.titleHint ? (
              <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-400">
                {item.titleHint}
              </p>
            ) : null}
            {optimizeError ? (
              <p className="mt-1 text-[11px] text-red-600">{optimizeError}</p>
            ) : null}
            <label className="mt-3 block">
              <span className="text-[11px] font-medium text-slate-500">
                功能模块
              </span>
              <select
                value={l1}
                onChange={(e) => setModule(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800"
              >
                <option value="">未选模块</option>
                {moduleChoices.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-slate-400">
                填一级模块，例如「设置」。
                {prefixKind ? "选中后名称自动带上。" : "知识点 / 竞品不写进名称前缀。"}
              </span>
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] font-medium text-slate-500">
                功能分区
              </span>
              <input
                list="peek-partition-options"
                value={l2}
                onChange={(e) => setPartition(e.target.value)}
                placeholder="二级区域，例如「网络」，可空"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800"
              />
              <datalist id="peek-partition-options">
                {partitionChoices.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <span className="mt-1 block text-[11px] text-slate-400">
                有二级可以自己再加，不会从模块树硬塞进名称。
              </span>
              {l2 ? (
                <span className="mt-1.5 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                  标签 · {l2}
                </span>
              ) : null}
            </label>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-slate-900">{item.title}</h2>
            {l1 ? (
              <p className="text-sm text-slate-500">
                模块：{l1}
                {l2 ? ` · 分区 ${l2}` : ""}
              </p>
            ) : null}
          </>
        )}
        {extraFields.length === 0 ? (
          <p className="text-sm text-slate-500">
            {editable ? "暂无更多字段。" : "点右上角打开完整页。"}
          </p>
        ) : (
          <dl className="space-y-3">
            {extraFields.map((f) => (
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
