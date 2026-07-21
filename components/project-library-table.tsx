"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CreateProjectButton,
  type SourceIdeaOption,
} from "@/components/create-project-button";
import { InlineCustomFieldCell } from "@/components/studio/inline-custom-field-cell";
import { ProjectColumnManager } from "@/components/studio/project-column-manager";
import { StudioBadge } from "@/components/studio/shell";
import {
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
  type StudioProjectColumnDef,
} from "@/lib/studio/types";
import { toProjectTree } from "@/lib/studio/project-tree";
import {
  DEFAULT_PROJECT_LIBRARY_WIDTHS,
  moveIdInOrder,
  readProjectLibraryOrder,
  readProjectLibraryWidths,
  sortProjectsByOrder,
  writeProjectLibraryOrder,
  writeProjectLibraryWidths,
} from "@/lib/studio/project-library-prefs";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const VIEW_TABS = [
  { id: "default", label: "默认视图", href: "/projects" },
  { id: "mainline", label: "当前主线", href: "/projects?status=mainline" },
  { id: "parking", label: "灵感停车场", href: "/projects?status=parking" },
  { id: "active", label: "进行中", href: "/projects?status=active" },
] as const;

const STATUS_OPTIONS: ProjectStatus[] = ["mainline", "active", "demo", "parking", "archived"];
const PRIORITY_OPTIONS: ProjectPriority[] = ["P0", "P1", "P2", "P3"];

function priorityTone(priority: string) {
  if (priority === "P0") return "p0" as const;
  if (priority === "P1") return "p1" as const;
  return "muted" as const;
}

function empty(text: string | null | undefined) {
  const t = text?.trim();
  return t ? t : "空白";
}

function effectiveNext(project: Project) {
  return project.nextAction?.trim() || project.body?.nextStep?.trim() || "";
}

async function patchProject(projectId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/studio/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("save failed");
}

function InlineTextField({
  projectId,
  field,
  value,
  emptyHint,
  lineClamp,
  warnEmpty,
}: {
  projectId: string;
  field: "nextAction" | "currentStage" | "positioning";
  value: string;
  emptyHint?: string;
  lineClamp?: boolean;
  warnEmpty?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function save() {
    const next = draft.trim();
    if (next === value.trim()) {
      setEditing(false);
      setError(false);
      return;
    }
    setSaving(true);
    setError(false);
    try {
      await patchProject(projectId, { [field]: next });
      setEditing(false);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
            setError(false);
          }
        }}
        placeholder={emptyHint}
        className={cn(
          "w-full rounded border border-indigo-300 bg-white px-1.5 py-0.5 text-sm text-slate-800 outline-none ring-2 ring-indigo-100",
          error && "border-red-400 ring-red-100"
        )}
      />
    );
  }

  const isEmpty = !value.trim();

  return (
    <button
      type="button"
      title="点击编辑"
      onClick={() => setEditing(true)}
      className={cn(
        "block w-full rounded px-1.5 py-0.5 text-left hover:bg-white/80 hover:ring-1 hover:ring-slate-200",
        isEmpty
          ? warnEmpty
            ? "bg-amber-50 text-amber-700/80 ring-1 ring-amber-100"
            : "text-slate-300"
          : "text-slate-600",
        lineClamp && !isEmpty && "line-clamp-2",
        error && "ring-1 ring-red-300"
      )}
    >
      {isEmpty ? emptyHint || "空白" : value}
    </button>
  );
}

function InlineSelectField<T extends string>({
  projectId,
  field,
  value,
  options,
  renderValue,
}: {
  projectId: string;
  field: "priority" | "status";
  value: T;
  options: T[];
  renderValue: (v: T) => ReactNode;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function onChange(next: T) {
    if (next === value) return;
    setSaving(true);
    try {
      await patchProject(projectId, { [field]: next });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative inline-flex items-center">
      {renderValue(value)}
      <select
        value={value}
        disabled={saving}
        aria-label={field === "priority" ? "优先级" : "状态"}
        onChange={(e) => void onChange(e.target.value as T)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {field === "status" ? PROJECT_STATUS_LABELS[opt as ProjectStatus] : opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function NextActionCell({
  project,
  taskDraft,
}: {
  project: Project;
  taskDraft?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(false);
  const next = effectiveNext(project);
  const empty = !next;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(next || taskDraft || "");
    setError(false);
    setEditing(true);
  }

  async function save() {
    const value = draft.trim();
    if (value === next) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(false);
    try {
      await patchProject(project.id, { nextAction: value });
      setEditing(false);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  async function applyDraft() {
    if (!taskDraft) return;
    setApplying(true);
    try {
      await patchProject(project.id, { nextAction: taskDraft });
      router.refresh();
    } finally {
      setApplying(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          }
          if (e.key === "Escape") {
            setEditing(false);
            setError(false);
          }
        }}
        placeholder={taskDraft ? `任务草稿：${taskDraft}` : "写下一步"}
        className={cn(
          "w-full rounded border border-indigo-300 bg-white px-1.5 py-0.5 text-sm text-slate-800 outline-none ring-2 ring-indigo-100",
          error && "border-red-400 ring-red-100"
        )}
      />
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        title="点击编辑"
        onClick={startEdit}
        className={cn(
          "block w-full rounded px-1.5 py-0.5 text-left hover:bg-white/80 hover:ring-1 hover:ring-slate-200",
          empty
            ? "bg-amber-50 text-amber-700/80 ring-1 ring-amber-100"
            : "line-clamp-2 text-slate-600"
        )}
      >
        {empty ? (taskDraft ? `草稿：${taskDraft}` : "未写下一步") : next}
      </button>
      {empty && taskDraft ? (
        <button
          type="button"
          disabled={applying}
          onClick={() => void applyDraft()}
          className="text-[11px] text-indigo-600 hover:underline disabled:opacity-50"
        >
          {applying ? "写入中…" : "采纳任务草稿"}
        </button>
      ) : null}
    </div>
  );
}

export function ProjectLibraryTable({
  projects,
  statusFilter,
  nextActionDrafts = {},
  sourceIdeas = [],
  columnDefs = [],
}: {
  projects: Project[];
  statusFilter?: string | null;
  nextActionDrafts?: Record<string, string>;
  sourceIdeas?: SourceIdeaOption[];
  columnDefs?: StudioProjectColumnDef[];
}) {
  const router = useRouter();
  const activeTab =
    statusFilter === "mainline" ||
    statusFilter === "parking" ||
    statusFilter === "active"
      ? statusFilter
      : "default";

  const missingNext = projects.filter((p) => {
    if (p.status === "archived" || p.status === "parking") return false;
    return !effectiveNext(p);
  }).length;

  const [widths, setWidths] = useState(DEFAULT_PROJECT_LIBRARY_WIDTHS);
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{
    id: string;
    place: "before" | "after" | "child";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const resizeRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    setWidths(readProjectLibraryWidths());
    setOrder(readProjectLibraryOrder());
  }, []);

  const sortedProjects = useMemo(
    () => sortProjectsByOrder(projects, order),
    [projects, order]
  );
  const treeItems = useMemo(() => toProjectTree(sortedProjects), [sortedProjects]);

  function persistOrder(next: string[]) {
    setOrder(next);
    writeProjectLibraryOrder(next);
  }

  function onResizeStart(key: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startW = widths[key] ?? DEFAULT_PROJECT_LIBRARY_WIDTHS[key] ?? 120;
    resizeRef.current = { key, startX: e.clientX, startW };
    let lastW = startW;
    const onMove = (ev: MouseEvent) => {
      const cur = resizeRef.current;
      if (!cur) return;
      lastW = Math.min(800, Math.max(48, cur.startW + (ev.clientX - cur.startX)));
      setWidths((prev) => ({ ...prev, [cur.key]: lastW }));
    };
    const onUp = () => {
      const cur = resizeRef.current;
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (cur) {
        setWidths((prev) => {
          const next = { ...prev, [cur.key]: lastW };
          writeProjectLibraryWidths(next);
          return next;
        });
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function addChild(parent: Project) {
    if (parent.parentId) {
      setMsg("仅支持一层子项目，请挂到顶层项目下");
      return;
    }
    const title = window.prompt(`在「${parent.title}」下新建子项目名称`);
    if (!title?.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/studio/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          parentId: parent.id,
          status: parent.status === "archived" ? "active" : parent.status,
          priority: parent.priority,
        }),
      });
      const data = (await res.json()) as { error?: string; project?: { id: string } };
      if (!res.ok || !data.project) {
        setMsg(data.error ?? "创建失败");
        return;
      }
      const base = order.length ? order : treeItems.map((t) => t.project.id);
      const idx = base.indexOf(parent.id);
      const next = [...base];
      if (!next.includes(data.project.id)) {
        next.splice(idx >= 0 ? idx + 1 : next.length, 0, data.project.id);
      }
      persistOrder(next);
      router.refresh();
    } catch {
      setMsg("创建失败");
    } finally {
      setBusy(false);
    }
  }

  function dropPlaceFromEvent(e: React.DragEvent, el: HTMLElement): "before" | "after" | "child" {
    const rect = el.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    if (y < 0.28) return "before";
    if (y > 0.72) return "after";
    return "child";
  }

  async function onDropRow(overId: string, place: "before" | "after" | "child") {
    if (!dragId || dragId === overId) {
      setDragId(null);
      setDropHint(null);
      return;
    }
    const byId = new Map(projects.map((p) => [p.id, p]));
    const drag = byId.get(dragId);
    const over = byId.get(overId);
    if (!drag || !over) {
      setDragId(null);
      setDropHint(null);
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      if (place === "child") {
        if (over.parentId) {
          setMsg("不能挂到子项目下（仅一层）");
          return;
        }
        if (projects.some((p) => p.parentId === drag.id)) {
          setMsg("已有子项目的项不能再挂到别人下面");
          return;
        }
        if (drag.parentId !== over.id) {
          await patchProject(drag.id, { parentId: over.id });
        }
        const base = order.length ? order : treeItems.map((t) => t.project.id);
        persistOrder(moveIdInOrder(base, dragId, overId, "after"));
        router.refresh();
        return;
      }

      const nextParent = over.parentId ?? null;
      if ((drag.parentId ?? null) !== nextParent) {
        if (nextParent && projects.some((p) => p.parentId === drag.id)) {
          setMsg("已有子项目的项不能再挂到别人下面");
          return;
        }
        await patchProject(drag.id, { parentId: nextParent });
      }
      const base = order.length ? order : treeItems.map((t) => t.project.id);
      persistOrder(moveIdInOrder(base, dragId, overId, place));
      router.refresh();
    } catch {
      setMsg("拖拽保存失败");
    } finally {
      setBusy(false);
      setDragId(null);
      setDropHint(null);
    }
  }

  function colW(key: string) {
    return widths[key] ?? DEFAULT_PROJECT_LIBRARY_WIDTHS[key] ?? 120;
  }

  function ResizableTh({
    colKey,
    children,
    sticky,
  }: {
    colKey: string;
    children: ReactNode;
    sticky?: boolean;
  }) {
    return (
      <th
        className={cn(
          "relative px-3 py-3 font-medium",
          sticky &&
            "sticky left-14 z-10 bg-slate-50 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]"
        )}
        style={{ width: colW(colKey), minWidth: colW(colKey) }}
      >
        {children}
        <span
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(e) => onResizeStart(colKey, e)}
          className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize hover:bg-indigo-400/50"
        />
      </th>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {VIEW_TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                activeTab === tab.id
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-slate-400">
            拖列宽 · 左侧 + 建子项目 · 拖手柄排序/挂子 · 点项目名进详情
          </p>
          <CreateProjectButton sourceIdeas={sourceIdeas} columnDefs={columnDefs} />
        </div>
      </div>

      <ProjectColumnManager columns={columnDefs} />

      {missingNext > 0 ? (
        <p className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs text-amber-800/90">
          {missingNext} 个进行中项目未写「下一步」
          {Object.keys(nextActionDrafts).length > 0
            ? " · 可从单元格采纳未完成任务草稿"
            : ""}
        </p>
      ) : null}

      {msg ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {msg}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th
                  className="sticky left-0 z-10 bg-slate-50 px-1 py-3"
                  style={{ width: colW("actions"), minWidth: colW("actions") }}
                />
                <ResizableTh colKey="title" sticky>
                  项目名
                </ResizableTh>
                <ResizableTh colKey="positioning">一句话定位</ResizableTh>
                <ResizableTh colKey="next">下一步</ResizableTh>
                <ResizableTh colKey="code">代码/目录</ResizableTh>
                <ResizableTh colKey="priority">优先级</ResizableTh>
                <ResizableTh colKey="demo">展示链接</ResizableTh>
                <ResizableTh colKey="status">状态</ResizableTh>
                <ResizableTh colKey="stage">当前阶段</ResizableTh>
                <ResizableTh colKey="git">Git</ResizableTh>
                {columnDefs.map((def) => (
                  <ResizableTh key={def.id} colKey={`custom:${def.id}`}>
                    {def.label}
                  </ResizableTh>
                ))}
                <ResizableTh colKey="updated">更新</ResizableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.length === 0 ? (
                <tr>
                  <td
                    colSpan={11 + columnDefs.length}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    没有符合条件的项目
                  </td>
                </tr>
              ) : (
                treeItems.map(({ project, depth, parentTitle }) => {
                  const demo = project.demoUrl || project.vercelUrl;
                  const hint = dropHint?.id === project.id ? dropHint.place : null;
                  return (
                    <tr
                      key={project.id}
                      className={cn(
                        "group hover:bg-indigo-50/40",
                        dragId === project.id && "opacity-50",
                        hint === "child" && "bg-indigo-50 ring-1 ring-inset ring-indigo-200"
                      )}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!dragId || dragId === project.id) return;
                        const place = dropPlaceFromEvent(e, e.currentTarget);
                        setDropHint({ id: project.id, place });
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const place =
                          dropHint?.id === project.id
                            ? dropHint.place
                            : dropPlaceFromEvent(e, e.currentTarget);
                        void onDropRow(project.id, place);
                      }}
                    >
                      <td
                        className={cn(
                          "sticky left-0 z-10 bg-white px-1 py-2 group-hover:bg-indigo-50/40",
                          hint === "before" && "border-t-2 border-indigo-400",
                          hint === "after" && "border-b-2 border-indigo-400"
                        )}
                        style={{ width: colW("actions") }}
                      >
                        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            title="新建子项目"
                            disabled={busy || !!project.parentId}
                            onClick={() => void addChild(project)}
                            className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-30"
                          >
                            +
                          </button>
                          <span
                            draggable
                            title="拖拽排序或挂到其他项目下"
                            onDragStart={() => setDragId(project.id)}
                            onDragEnd={() => {
                              setDragId(null);
                              setDropHint(null);
                            }}
                            className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-slate-300 active:cursor-grabbing"
                          >
                            ⋮⋮
                          </span>
                        </div>
                      </td>
                      <td
                        className="sticky left-14 z-10 bg-white px-3 py-3 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] group-hover:bg-indigo-50/40"
                        style={{ width: colW("title") }}
                      >
                        <div className={cn(depth === 1 && "ml-5 border-l-2 border-slate-200 pl-3")}>
                          {depth === 1 && parentTitle ? (
                            <div className="mb-0.5 text-[11px] text-slate-400">
                              子项目 · {parentTitle}
                            </div>
                          ) : null}
                          <Link
                            href={`/projects/${project.id}`}
                            className="font-medium text-slate-900 hover:text-indigo-700"
                          >
                            {depth === 1 ? `↳ ${project.title}` : project.title}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-3" style={{ width: colW("positioning") }}>
                        <InlineTextField
                          projectId={project.id}
                          field="positioning"
                          value={project.positioning ?? ""}
                          lineClamp
                        />
                      </td>
                      <td className="px-3 py-3" style={{ width: colW("next") }}>
                        <NextActionCell
                          project={project}
                          taskDraft={nextActionDrafts[project.id]}
                        />
                      </td>
                      <td
                        className="px-3 py-3 font-mono text-xs text-slate-500"
                        style={{ width: colW("code") }}
                      >
                        <span className={project.codePath ? "" : "text-slate-300"}>
                          {empty(project.codePath)}
                        </span>
                      </td>
                      <td className="px-3 py-3" style={{ width: colW("priority") }}>
                        <InlineSelectField
                          projectId={project.id}
                          field="priority"
                          value={project.priority}
                          options={PRIORITY_OPTIONS}
                          renderValue={(v) => (
                            <StudioBadge tone={priorityTone(v)}>{v}</StudioBadge>
                          )}
                        />
                      </td>
                      <td className="px-3 py-3" style={{ width: colW("demo") }}>
                        {demo ? (
                          <a
                            href={demo}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-indigo-600 hover:underline"
                          >
                            {demo.replace(/^https?:\/\//, "").slice(0, 28)}
                          </a>
                        ) : (
                          <span className="text-slate-300">空白</span>
                        )}
                      </td>
                      <td className="px-3 py-3" style={{ width: colW("status") }}>
                        <InlineSelectField
                          projectId={project.id}
                          field="status"
                          value={project.status}
                          options={STATUS_OPTIONS}
                          renderValue={(v) => (
                            <StudioBadge
                              tone={
                                v === "mainline"
                                  ? "mainline"
                                  : v === "parking"
                                    ? "warning"
                                    : "muted"
                              }
                            >
                              {PROJECT_STATUS_LABELS[v]}
                            </StudioBadge>
                          )}
                        />
                      </td>
                      <td className="px-3 py-3" style={{ width: colW("stage") }}>
                        <InlineTextField
                          projectId={project.id}
                          field="currentStage"
                          value={project.currentStage ?? ""}
                        />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500" style={{ width: colW("git") }}>
                        {project.githubRepo ? (
                          <span className="truncate">{project.githubRepo}</span>
                        ) : (
                          <span className="text-slate-300">空白</span>
                        )}
                      </td>
                      {columnDefs.map((def) => (
                        <td
                          key={def.id}
                          className="px-3 py-3"
                          style={{ width: colW(`custom:${def.id}`) }}
                        >
                          <InlineCustomFieldCell
                            projectId={project.id}
                            def={def}
                            value={project.customFields?.[def.key]}
                          />
                        </td>
                      ))}
                      <td
                        className="px-3 py-3 tabular-nums text-xs text-slate-400"
                        style={{ width: colW("updated") }}
                      >
                        {new Date(project.updatedAt).toLocaleDateString("zh-CN")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
