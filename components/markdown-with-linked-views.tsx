"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LinkedViewBlock } from "@/components/linked-view-block";
import { MarkdownPreview } from "@/components/studio/markdown-preview";
import { linkedViewSources } from "@/lib/linked-views/catalog";
import type { LinkedViewConfig, LinkedViewSourceId } from "@/lib/linked-views/config";
import type { LinkedViewLibraryRows } from "@/lib/linked-views/build-libraries";
import type { LinkedViewRow } from "@/lib/linked-views/query";
import {
  defaultLinkedViewConfig,
  explodeMdBlocks,
  joinBodySegments,
  splitBodySegments,
  type BodySegment,
} from "@/lib/linked-views/segments";

function slashQuery(text: string, caret: number): { start: number; q: string } | null {
  const until = text.slice(0, caret);
  const lineStart = until.lastIndexOf("\n") + 1;
  const line = until.slice(lineStart);
  const m = line.match(/^\/(\S*)$/);
  if (!m) return null;
  return { start: lineStart, q: m[1] ?? "" };
}

export function MarkdownWithLinkedViews({
  content,
  projectId,
  projectSlug,
  libraries,
  canEdit = false,
  editing = false,
  defaultModuleName,
  moduleOptions,
  onChange,
  onOpenRow,
}: {
  content: string;
  projectId?: string;
  projectSlug: string;
  libraries: LinkedViewLibraryRows;
  canEdit?: boolean;
  editing?: boolean;
  defaultModuleName?: string;
  moduleOptions?: string[];
  onChange?: (next: string) => void;
  onOpenRow?: (row: LinkedViewRow) => void;
}) {
  const sources = useMemo(() => linkedViewSources(projectSlug), [projectSlug]);
  const parsed = useMemo(
    () => explodeMdBlocks(splitBodySegments(content)),
    [content]
  );
  const [local, setLocal] = useState<BodySegment[] | null>(null);
  const blockEditing = Boolean(canEdit && onChange && editing);
  const segments = blockEditing && local ? local : parsed;
  const [picker, setPicker] = useState<{
    index: number;
    slash?: { start: number; end: number };
    skipSlash?: boolean;
  } | null>(null);
  const [slashFilter, setSlashFilter] = useState("");
  const [focusedMdIndex, setFocusedMdIndex] = useState(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const taRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    if (blockEditing) setLocal(explodeMdBlocks(splitBodySegments(content)));
    else setLocal(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockEditing]);

  function emit(next: BodySegment[]) {
    if (blockEditing) setLocal(next);
    onChange?.(joinBodySegments(next));
  }

  function updateView(id: string, config: LinkedViewConfig) {
    emit(
      segments.map((s) => (s.type === "view" && s.id === id ? { ...s, config } : s))
    );
  }

  function removeView(id: string) {
    emit(segments.filter((s) => !(s.type === "view" && s.id === id)));
  }

  function moveBlock(fromId: string, toIndex: number) {
    const from = segments.findIndex((s) => s.id === fromId);
    if (from < 0 || from === toIndex) return;
    const next = [...segments];
    const [item] = next.splice(from, 1);
    if (!item) return;
    const dest = from < toIndex ? toIndex - 1 : toIndex;
    next.splice(Math.max(0, dest), 0, item);
    emit(next);
  }

  function insertMd(atIndex: number, text: string, slash?: { start: number; end: number }) {
    const next = [...segments];
    const seg = next[atIndex];
    const block: BodySegment = { type: "md", id: `md-${Date.now()}`, text };
    if (!seg || seg.type !== "md") {
      next.splice(atIndex + 1, 0, block);
      emit(next);
      return;
    }
    if (slash) {
      const before = seg.text.slice(0, slash.start);
      const after = seg.text.slice(slash.end);
      next.splice(
        atIndex,
        1,
        { type: "md", id: `${seg.id}-a`, text: before },
        block,
        { type: "md", id: `${seg.id}-b`, text: after }
      );
    } else {
      next.splice(atIndex + 1, 0, block);
    }
    emit(next);
  }

  function insertView(
    source: LinkedViewSourceId,
    atMdIndex: number,
    slash?: { start: number; end: number }
  ) {
    const meta = sources.find((s) => s.id === source);
    const config = defaultLinkedViewConfig({
      source,
      title: meta?.label ?? "关联视图",
      moduleName: defaultModuleName,
    });
    const next = [...segments];
    const seg = next[atMdIndex];
    const viewSeg: BodySegment = {
      type: "view",
      id: `view-${Date.now()}`,
      config,
    };
    if (!seg || seg.type !== "md") {
      next.push(viewSeg);
      emit(next);
      setPicker(null);
      setSlashFilter("");
      return;
    }
    const ta = taRefs.current[seg.id];
    const start = slash?.start ?? ta?.selectionStart ?? seg.text.length;
    const end = slash?.end ?? start;
    const before = seg.text.slice(0, start);
    const after = seg.text.slice(end);
    next.splice(
      atMdIndex,
      1,
      { type: "md", id: `${seg.id}-a`, text: before },
      viewSeg,
      { type: "md", id: `${seg.id}-b`, text: after }
    );
    emit(next);
    setPicker(null);
    setSlashFilter("");
  }

  function openInsertMenu() {
    let idx = focusedMdIndex;
    if (!segments[idx] || segments[idx]?.type !== "md") {
      idx = segments.findIndex((s) => s.type === "md");
    }
    setPicker({ index: idx < 0 ? 0 : idx, skipSlash: true });
  }

  function onPickBlock(
    kind: "text" | "heading" | "list" | "view",
    index: number,
    slash?: { start: number; end: number }
  ) {
    if (kind === "view") {
      setPicker({ index, slash, skipSlash: true });
      setSlashFilter("");
      return;
    }
    const text = kind === "heading" ? "## " : kind === "list" ? "- " : "";
    insertMd(index, text, slash);
    setPicker(null);
    setSlashFilter("");
  }

  const viewMode = !blockEditing;

  return (
    <div className="space-y-1">
      {canEdit && onChange ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openInsertMenu}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            插入块
          </button>
          <span className="text-[11px] text-slate-400">
            行首输入 / 插入标题、列表或关联视图；左侧 ⋮⋮ 拖动排序
          </span>
        </div>
      ) : null}

      {segments.map((seg, index) => {
        const frame = (inner: ReactNode) => (
          <div
            key={seg.id}
            className="group relative pl-6"
            onDragOver={(e) => {
              if (!blockEditing || !dragId) return;
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (!dragId) return;
              moveBlock(dragId, index);
              setDragId(null);
            }}
          >
            {blockEditing ? (
              <button
                type="button"
                draggable
                onDragStart={() => setDragId(seg.id)}
                onDragEnd={() => setDragId(null)}
                className="absolute left-0 top-2 cursor-grab text-xs text-slate-300 opacity-0 hover:text-slate-500 group-hover:opacity-100"
                title="拖动排序"
                aria-label="拖动块"
              >
                ⋮⋮
              </button>
            ) : null}
            {inner}
          </div>
        );

        if (seg.type === "view") {
          return frame(
            <LinkedViewBlock
              projectId={projectId}
              projectSlug={projectSlug}
              config={seg.config}
              rows={libraries[seg.config.source] ?? []}
              source={sources.find((s) => s.id === seg.config.source)}
              canEdit={canEdit}
              onChange={onChange ? (cfg) => updateView(seg.id, cfg) : undefined}
              onDelete={canEdit && onChange ? () => removeView(seg.id) : undefined}
              onOpenRow={onOpenRow}
              moduleOptions={moduleOptions}
            />
          );
        }
        if (viewMode) {
          const text = seg.text.trim();
          if (!text) return null;
          return frame(
            <MarkdownPreview
              content={seg.text}
              withHeadingIds
              preferInAppLinks
            />
          );
        }
        const showSlash =
          Boolean(picker) &&
          canEdit &&
          !picker?.skipSlash &&
          picker?.index === index;
        return frame(
          <div>
            <textarea
              ref={(el) => {
                taRefs.current[seg.id] = el;
              }}
              value={seg.text}
              onFocus={() => setFocusedMdIndex(index)}
              onChange={(e) => {
                const value = e.target.value;
                const caret = e.target.selectionStart ?? value.length;
                emit(
                  segments.map((s) =>
                    s.id === seg.id && s.type === "md" ? { ...s, text: value } : s
                  )
                );
                const hit = slashQuery(value, caret);
                if (hit) {
                  setPicker({
                    index,
                    slash: { start: hit.start, end: caret },
                  });
                  setSlashFilter(hit.q);
                } else if (picker?.index === index && !picker.skipSlash) {
                  setPicker(null);
                  setSlashFilter("");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setPicker(null);
                  setSlashFilter("");
                }
              }}
              rows={Math.max(2, seg.text.split("\n").length + 1)}
              placeholder="输入文字，或 / 插入块"
              className="w-full resize-y rounded-lg border border-transparent px-2 py-1.5 text-sm leading-relaxed text-slate-800 hover:border-slate-200 focus:border-slate-300"
            />
            {showSlash && picker ? (
              <SlashAndSourceMenu
                query={slashFilter}
                sources={sources}
                onPickBlock={(kind) => onPickBlock(kind, picker.index, picker.slash)}
                onPickSource={(id) => insertView(id, picker.index, picker.slash)}
                onClose={() => {
                  setPicker(null);
                  setSlashFilter("");
                }}
              />
            ) : null}
          </div>
        );
      })}

      {viewMode &&
      canEdit &&
      onChange &&
      !segments.some((s) => s.type === "view" || (s.type === "md" && s.text.trim())) ? (
        <p className="text-sm text-slate-400">
          暂无正文。点「插入块」，或输入 / 。
        </p>
      ) : null}

      {picker && canEdit && picker.skipSlash ? (
        <SlashAndSourceMenu
          key="toolbar"
          query={slashFilter}
          skipSlash
          sources={sources}
          onPickBlock={(kind) => onPickBlock(kind, picker.index, picker.slash)}
          onPickSource={(id) => insertView(id, picker.index, picker.slash)}
          onClose={() => {
            setPicker(null);
            setSlashFilter("");
          }}
        />
      ) : null}
    </div>
  );
}

function SlashAndSourceMenu({
  query,
  skipSlash,
  sources,
  onPickBlock,
  onPickSource,
  onClose,
}: {
  query: string;
  skipSlash?: boolean;
  sources: ReturnType<typeof linkedViewSources>;
  onPickBlock: (kind: "text" | "heading" | "list" | "view") => void;
  onPickSource: (id: LinkedViewSourceId) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"slash" | "source">(
    skipSlash ? "slash" : "slash"
  );
  const q = query.trim().toLowerCase();
  const items = [
    { id: "text" as const, label: "文本", hint: "普通段落", keys: "文本段落文字text" },
    { id: "heading" as const, label: "标题", hint: "## 章节", keys: "标题heading h1 h2" },
    { id: "list" as const, label: "列表", hint: "• 条目", keys: "列表list ul" },
    {
      id: "view" as const,
      label: "数据源的链接视图",
      hint: "把现有总库嵌进这一页",
      keys: "数据源的链接视图关联视图linked view 库",
    },
  ].filter((it) => !q || it.keys.includes(q) || it.label.includes(query.trim()));

  if (step === "source") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="p-2">
          <p className="px-2 py-1 text-[11px] text-slate-400">选择要嵌入的库</p>
          {sources.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPickSource(s.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="text-slate-400">▦</span>
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-50"
          >
            关闭菜单
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-lg">
      <div className="p-2">
        <p className="px-2 py-1 text-[11px] text-slate-400">插入块</p>
        {items.length === 0 ? (
          <p className="px-2 py-3 text-xs text-slate-400">无匹配区块</p>
        ) : (
          items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => {
                if (it.id === "view") setStep("source");
                else onPickBlock(it.id);
              }}
              className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
            >
              <span className="mt-0.5 text-slate-400">
                {it.id === "view" ? "▦" : it.id === "heading" ? "H" : it.id === "list" ? "•" : "¶"}
              </span>
              <span>
                <span className="block text-sm text-slate-800">{it.label}</span>
                <span className="block text-[11px] text-slate-400">{it.hint}</span>
              </span>
            </button>
          ))
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-50"
        >
          关闭菜单
        </button>
      </div>
    </div>
  );
}
