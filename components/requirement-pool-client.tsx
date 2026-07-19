"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createPoolRequirementAction,
  deletePoolRequirementAction,
  promotePoolRequirementAction,
  savePoolRequirementAction,
} from "@/lib/actions";
import { PoolColumnManager } from "@/components/pool-column-manager";
import { TASK_STATUS_LABELS, type Iteration, type ModuleNode, type PoolColumnDef, type Requirement, type TaskStatus } from "@/lib/types";

const STATUS_OPTIONS: TaskStatus[] = [
  "pending",
  "in_progress",
  "testing",
  "acceptance",
  "done",
  "blocked",
];

export function RequirementPoolClient({
  projectId,
  projectSlug,
  requirements,
  modules,
  activeIterations,
  columnDefs,
  tagOptions,
}: {
  projectId: string;
  projectSlug: string;
  requirements: Requirement[];
  modules: ModuleNode[];
  activeIterations: Iteration[];
  columnDefs: PoolColumnDef[];
  tagOptions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filterModule, setFilterModule] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const moduleNameById = useMemo(() => {
    const map = new Map<string, string>();
    modules.forEach((m) => map.set(m.id, m.name));
    return map;
  }, [modules]);

  const moduleGroups = useMemo(() => {
    const groups = new Map<string, Requirement[]>();
    for (const req of requirements) {
      const key = req.module_l1_id ?? "__none__";
      const list = groups.get(key) ?? [];
      list.push(req);
      groups.set(key, list);
    }
    return groups;
  }, [requirements]);

  const visibleRequirements = useMemo(() => {
    if (!filterModule) return requirements;
    if (filterModule === "__none__") {
      return requirements.filter((r) => !r.module_l1_id);
    }
    return requirements.filter((r) => r.module_l1_id === filterModule);
  }, [requirements, filterModule]);

  function saveField(
    requirementId: string,
    field: keyof Requirement,
    value: string | boolean | number | string[] | null
  ) {
    startTransition(async () => {
      await savePoolRequirementAction({
        requirementId,
        projectSlug,
        updates: { [field]: value } as Parameters<typeof savePoolRequirementAction>[0]["updates"],
      });
      router.refresh();
    });
  }

  function saveCustomField(requirementId: string, key: string, value: string | number | boolean | null) {
    startTransition(async () => {
      await savePoolRequirementAction({
        requirementId,
        projectSlug,
        updates: { custom_fields: { [key]: value } },
      });
      router.refresh();
    });
  }

  function addRow() {
    startTransition(async () => {
      await createPoolRequirementAction(projectSlug, projectId);
      router.refresh();
    });
  }

  function removeRow(requirementId: string) {
    if (!confirm("确定从需求池删除该功能点？")) return;
    startTransition(async () => {
      await deletePoolRequirementAction(requirementId, projectSlug);
      router.refresh();
    });
  }

  function promote(requirementId: string, iterationId: string) {
    startTransition(async () => {
      await promotePoolRequirementAction({ requirementId, iterationId, projectSlug });
      setMessage("已加入迭代，可在下方「看板视图」跟进");
      router.refresh();
    });
  }

  const defaultIterationId = activeIterations[0]?.id;

  return (
    <div className="space-y-4">
      <PoolColumnManager
        projectId={projectId}
        projectSlug={projectSlug}
        columnDefs={columnDefs}
        tagOptions={tagOptions}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          仅产品可见。规划成熟后「加入迭代」，在下方看板视图跟进。
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={addRow}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          + 新建功能点
        </button>
      </div>

      {message ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {message}
        </div>
      ) : null}

      {modules.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterModule(null)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filterModule === null
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-200 text-slate-600"
            }`}
          >
            全部
          </button>
          {Array.from(moduleGroups.entries()).map(([modId, items]) => {
            const label =
              modId === "__none__" ? "未分组" : moduleNameById.get(modId) ?? "模块";
            return (
              <button
                key={modId}
                type="button"
                onClick={() => setFilterModule(modId)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  filterModule === modId
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                {label} ({items.length})
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[2000px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 w-36">功能点</th>
                <th className="px-3 py-3 w-20">模块</th>
                <th className="px-3 py-3 w-20">细分</th>
                <th className="px-3 py-3 w-24">标签</th>
                <th className="px-3 py-3 w-16">预估h</th>
                <th className="px-3 py-3 w-28">PRD</th>
                <th className="px-3 py-3 w-28">原型</th>
                <th className="px-3 py-3 w-16">分类</th>
                <th className="px-3 py-3 w-16">阶段</th>
                <th className="px-3 py-3 w-20">状态</th>
                <th className="px-3 py-3 w-14">优先级</th>
                <th className="px-3 py-3 w-28">提出时间</th>
                <th className="px-3 py-3 w-28">截止</th>
                <th className="px-3 py-3 w-12">讨论</th>
                {columnDefs.map((def) => (
                  <th key={def.id} className="px-3 py-3 min-w-[100px]">
                    {def.label}
                  </th>
                ))}
                <th className="px-3 py-3 min-w-[100px]">优化方向</th>
                <th className="px-3 py-3 min-w-[100px]">问题</th>
                <th className="px-3 py-3 w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequirements.length === 0 ? (
                <tr>
                  <td colSpan={16 + columnDefs.length} className="px-4 py-10 text-center text-slate-500">
                    需求池为空。可手动新建，或在「Excel 导入」页导入 Notion CSV。
                  </td>
                </tr>
              ) : (
                visibleRequirements.map((req) => (
                  <PoolRow
                    key={req.id}
                    req={req}
                    projectSlug={projectSlug}
                    moduleLabel={
                      req.module_l1_id
                        ? moduleNameById.get(req.module_l1_id) ?? "—"
                        : "—"
                    }
                    pending={pending}
                    defaultIterationId={defaultIterationId}
                    activeIterations={activeIterations}
                    columnDefs={columnDefs}
                    tagOptions={tagOptions}
                    onSave={saveField}
                    onSaveCustom={saveCustomField}
                    onDelete={() => removeRow(req.id)}
                    onPromote={(iterationId) => promote(req.id, iterationId)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PoolRow({
  req,
  projectSlug,
  moduleLabel,
  pending,
  defaultIterationId,
  activeIterations,
  columnDefs,
  tagOptions,
  onSave,
  onSaveCustom,
  onDelete,
  onPromote,
}: {
  req: Requirement;
  projectSlug: string;
  moduleLabel: string;
  pending: boolean;
  defaultIterationId?: string;
  activeIterations: Iteration[];
  columnDefs: PoolColumnDef[];
  tagOptions: string[];
  onSave: (id: string, field: keyof Requirement, value: string | boolean | number | string[] | null) => void;
  onSaveCustom: (id: string, key: string, value: string | number | boolean | null) => void;
  onDelete: () => void;
  onPromote: (iterationId: string) => void;
}) {
  const [iterationId, setIterationId] = useState(defaultIterationId ?? "");
  const tags = req.tags ?? [];
  const allTags = Array.from(new Set([...tagOptions, ...tags]));

  return (
    <tr className="border-t border-slate-100 align-top hover:bg-slate-50/60">
      <td className="px-2 py-2">
        <div className="flex items-start gap-1">
          <Link
            href={`/projects/${projectSlug}/requirements/${req.id}`}
            title="打开需求页"
            className="mt-1.5 shrink-0 rounded px-1 text-indigo-600 hover:bg-indigo-50"
          >
            ↗
          </Link>
          <CellInput
            value={req.title}
            disabled={pending}
            onCommit={(v) => onSave(req.id, "title", v)}
          />
        </div>
      </td>
      <td className="px-2 py-2 text-xs text-slate-600">{moduleLabel}</td>
      <td className="px-2 py-2">
        <CellInput
          value={req.sub_function ?? ""}
          disabled={pending}
          onCommit={(v) => onSave(req.id, "sub_function", v || null)}
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex max-w-[140px] flex-wrap gap-1">
          {allTags.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                disabled={pending}
                onClick={() => {
                  const next = active ? tags.filter((t) => t !== tag) : [...tags, tag];
                  onSave(req.id, "tags", next);
                }}
                className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                  active
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </td>
      <td className="px-2 py-2">
        <CellInput
          type="number"
          value={req.product_estimate_hours != null ? String(req.product_estimate_hours) : ""}
          disabled={pending}
          onCommit={(v) => onSave(req.id, "product_estimate_hours", v ? Number(v) : null)}
        />
      </td>
      <td className="px-2 py-2">
        <CellInput
          value={req.prd_link ?? ""}
          disabled={pending}
          onCommit={(v) => onSave(req.id, "prd_link", v || null)}
        />
      </td>
      <td className="px-2 py-2">
        <CellInput
          value={req.prototype_link ?? ""}
          disabled={pending}
          onCommit={(v) => onSave(req.id, "prototype_link", v || null)}
        />
      </td>
      <td className="px-2 py-2">
        <CellInput
          value={req.category ?? ""}
          disabled={pending}
          onCommit={(v) => onSave(req.id, "category", v || null)}
        />
      </td>
      <td className="px-2 py-2">
        <CellInput
          value={req.stage_type ?? ""}
          disabled={pending}
          onCommit={(v) => onSave(req.id, "stage_type", v || null)}
        />
      </td>
      <td className="px-2 py-2">
        <select
          className="w-full rounded border border-slate-200 px-1 py-1 text-xs"
          value={req.status}
          disabled={pending}
          onChange={(e) => onSave(req.id, "status", e.target.value)}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <CellInput
          value={req.priority ?? ""}
          disabled={pending}
          onCommit={(v) => onSave(req.id, "priority", v || null)}
        />
      </td>
      <td className="px-2 py-2">
        <CellInput
          type="date"
          value={req.submitted_at ?? req.created_at.slice(0, 10)}
          disabled={pending}
          onCommit={(v) => onSave(req.id, "submitted_at", v || null)}
        />
      </td>
      <td className="px-2 py-2">
        <CellInput
          type="date"
          value={req.due_date ?? ""}
          disabled={pending}
          onCommit={(v) => onSave(req.id, "due_date", v || null)}
        />
      </td>
      <td className="px-2 py-2 text-center">
        <input
          type="checkbox"
          checked={req.needs_discussion}
          disabled={pending}
          onChange={(e) => onSave(req.id, "needs_discussion", e.target.checked)}
        />
      </td>
      {columnDefs.map((def) => (
        <td key={def.id} className="px-2 py-2">
          <CustomFieldCell
            def={def}
            value={req.custom_fields?.[def.key] ?? null}
            disabled={pending}
            onCommit={(v) => onSaveCustom(req.id, def.key, v)}
          />
        </td>
      ))}
      <td className="px-2 py-2">
        <CellTextarea
          value={req.optimization_notes ?? ""}
          disabled={pending}
          onCommit={(v) => onSave(req.id, "optimization_notes", v || null)}
        />
      </td>
      <td className="px-2 py-2">
        <CellTextarea
          value={req.known_issues ?? ""}
          disabled={pending}
          onCommit={(v) => onSave(req.id, "known_issues", v || null)}
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex flex-col gap-1">
          {activeIterations.length > 0 ? (
            <>
              <select
                className="rounded border border-slate-200 px-2 py-1 text-xs"
                value={iterationId}
                onChange={(e) => setIterationId(e.target.value)}
              >
                {activeIterations.map((iter) => (
                  <option key={iter.id} value={iter.id}>
                    {iter.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={pending || !iterationId}
                onClick={() => onPromote(iterationId)}
                className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
              >
                加入迭代
              </button>
            </>
          ) : (
            <span className="text-xs text-amber-600">请先 Excel 导入创建迭代</span>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="text-xs text-red-600 hover:underline"
          >
            删除
          </button>
        </div>
      </td>
    </tr>
  );
}

function CellInput({
  value,
  disabled,
  type = "text",
  onCommit,
}: {
  value: string;
  disabled: boolean;
  type?: "text" | "date" | "number";
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  return (
    <input
      type={type === "number" ? "number" : type}
      step={type === "number" ? "0.5" : undefined}
      className="w-full rounded border border-transparent px-2 py-1 text-xs hover:border-slate-200 focus:border-blue-400 focus:outline-none"
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
    />
  );
}

function CustomFieldCell({
  def,
  value,
  disabled,
  onCommit,
}: {
  def: PoolColumnDef;
  value: string | number | boolean | null;
  disabled: boolean;
  onCommit: (value: string | number | boolean | null) => void;
}) {
  if (def.column_type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        disabled={disabled}
        onChange={(e) => onCommit(e.target.checked)}
      />
    );
  }
  if (def.column_type === "select") {
    return (
      <select
        className="w-full rounded border border-slate-200 px-1 py-1 text-xs"
        value={String(value ?? "")}
        disabled={disabled}
        onChange={(e) => onCommit(e.target.value || null)}
      >
        <option value="">—</option>
        {def.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  return (
    <CellInput
      type={
        def.column_type === "number"
          ? "number"
          : def.column_type === "date"
            ? "date"
            : "text"
      }
      value={value != null ? String(value) : ""}
      disabled={disabled}
      onCommit={(v) => {
        if (def.column_type === "number") onCommit(v ? Number(v) : null);
        else onCommit(v || null);
      }}
    />
  );
}

function CellTextarea({
  value,
  disabled,
  onCommit,
}: {
  value: string;
  disabled: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  return (
    <textarea
      className="w-full min-h-[52px] rounded border border-transparent px-2 py-1 text-xs leading-relaxed hover:border-slate-200 focus:border-blue-400 focus:outline-none"
      value={draft}
      disabled={disabled}
      rows={2}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
    />
  );
}
