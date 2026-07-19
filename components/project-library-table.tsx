"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
            定位/下一步/阶段/优先级/状态/自定义列可点改 · 点项目名进详情
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                <th className="sticky left-0 z-10 min-w-[200px] bg-slate-50 px-4 py-3 font-medium shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]">
                  项目名
                </th>
                <th className="min-w-[220px] px-3 py-3 font-medium">一句话定位</th>
                <th className="min-w-[240px] px-3 py-3 font-medium">下一步</th>
                <th className="min-w-[160px] px-3 py-3 font-medium">代码/目录</th>
                <th className="min-w-[72px] px-3 py-3 font-medium">优先级</th>
                <th className="min-w-[160px] px-3 py-3 font-medium">展示链接</th>
                <th className="min-w-[88px] px-3 py-3 font-medium">状态</th>
                <th className="min-w-[120px] px-3 py-3 font-medium">当前阶段</th>
                <th className="min-w-[160px] px-3 py-3 font-medium">Git</th>
                {columnDefs.map((def) => (
                  <th key={def.id} className="min-w-[120px] px-3 py-3 font-medium">
                    {def.label}
                  </th>
                ))}
                <th className="min-w-[100px] px-3 py-3 font-medium">更新</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.length === 0 ? (
                <tr>
                  <td
                    colSpan={10 + columnDefs.length}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    没有符合条件的项目
                  </td>
                </tr>
              ) : (
                projects.map((project) => {
                  const demo = project.demoUrl || project.vercelUrl;
                  return (
                    <tr key={project.id} className="group hover:bg-indigo-50/40">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] group-hover:bg-indigo-50/40">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-medium text-slate-900 hover:text-indigo-700"
                        >
                          {project.title}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <InlineTextField
                          projectId={project.id}
                          field="positioning"
                          value={project.positioning ?? ""}
                          lineClamp
                        />
                      </td>
                      <td className="px-3 py-3">
                        <NextActionCell
                          project={project}
                          taskDraft={nextActionDrafts[project.id]}
                        />
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">
                        <span className={project.codePath ? "" : "text-slate-300"}>
                          {empty(project.codePath)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
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
                      <td className="px-3 py-3">
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
                      <td className="px-3 py-3">
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
                      <td className="px-3 py-3">
                        <InlineTextField
                          projectId={project.id}
                          field="currentStage"
                          value={project.currentStage ?? ""}
                        />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {project.githubRepo ? (
                          <span className="truncate">{project.githubRepo}</span>
                        ) : (
                          <span className="text-slate-300">空白</span>
                        )}
                      </td>
                      {columnDefs.map((def) => (
                        <td key={def.id} className="px-3 py-3">
                          <InlineCustomFieldCell
                            projectId={project.id}
                            def={def}
                            value={project.customFields?.[def.key]}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-3 tabular-nums text-xs text-slate-400">
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
