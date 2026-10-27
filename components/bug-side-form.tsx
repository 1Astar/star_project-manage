"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addBugCommentAction,
  createBugAction,
  createBugTestPlanAction,
  generateRequirementFromBugSuggestionAction,
  updateBugAction,
  updateBugStatusAction,
  updateCompetitorEntryAction,
  updateLearningNoteAction,
} from "@/lib/actions";
import { BackLink } from "@/components/back-button";
import { BugAttachmentsBlock } from "@/components/bug-attachments";
import {
  CrossLinkSection,
  type CrossLinkOption,
} from "@/components/cross-link-section";
import {
  EntitySidePeek,
  type EntityPeekPayload,
} from "@/components/entity-side-peek";
import { assigneeRosterNames, PRODUCT_ASSIGNEE_NAME } from "@/lib/assignee-roster";
import { BugTypeSelect } from "@/components/bug-type-select";
import {
  BUG_ENV_OPTIONS,
  BUG_PRIORITY_LABELS,
  BUG_PRIORITY_OPTIONS,
  type BugPriority,
} from "@/lib/bugs/fields";
import type {
  Bug,
  BugAttachment,
  BugComment,
  BugSeverity,
  BugTestPlan,
  BugType,
  Iteration,
  TaskStatus,
} from "@/lib/types";
import {
  BUG_SEVERITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/types";
import { ImageDropZone } from "@/components/image-drop-zone";

const STATUS_OPTIONS: TaskStatus[] = [
  "pending",
  "in_progress",
  "testing",
  "acceptance",
  "done",
  "blocked",
];

const SEVERITIES = [1, 2, 3, 4] as BugSeverity[];

export type BugFormOption = { id: string; title: string; inPool?: boolean };
export type MemberOption = { name: string };

type SharedFields = {
  title: string;
  precondition: string;
  reproSteps: string;
  expectedResult: string;
  actualResult: string;
  description: string;
  suggestion: string;
  modulePath: string;
  foundVersion: string;
  resolvedVersion: string;
  environments: string[];
  priority: BugPriority | "";
  severity: BugSeverity;
  bugType: BugType;
  assignee: string;
  reporterName: string;
  updatedBy: string;
  watchers: string[];
  requirementId: string;
  testPlanId: string;
  executionCase: string;
  iterationId: string;
  status: TaskStatus;
};

const EMPTY_FIELDS = (overrides?: Partial<SharedFields>): SharedFields => ({
  title: "",
  precondition: "",
  reproSteps: "",
  expectedResult: "",
  actualResult: "",
  description: "",
  suggestion: "",
  modulePath: "",
  foundVersion: "",
  resolvedVersion: "",
  environments: [],
  priority: "",
  severity: 3,
  bugType: "code",
  assignee: "",
  reporterName: "",
  updatedBy: "",
  watchers: [],
  requirementId: "",
  testPlanId: "",
  executionCase: "",
  iterationId: "",
  status: "pending",
  ...overrides,
});

async function uploadBugPendingFiles(
  projectId: string,
  bugId: string,
  files: File[]
) {
  for (const file of files) {
    const form = new FormData();
    form.set("projectId", projectId);
    form.set("bugId", bugId);
    form.set("title", file.name);
    form.set("file", file);
    const res = await fetch("/api/projects/bug-attachments", {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof data.error === "string" ? data.error : `附件上传失败：${file.name}`
      );
    }
  }
}

function toggleEnv(list: string[], tag: string): string[] {
  return list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag];
}

function ReproTemplateFields({
  value,
  onChange,
}: {
  value: SharedFields;
  onChange: (patch: Partial<SharedFields>) => void;
}) {
  return (
    <>
      <section className="space-y-1.5 border-t border-slate-100 pt-3">
        <h4 className="text-xs font-semibold text-slate-500">前置条件</h4>
        <textarea
          value={value.precondition}
          onChange={(e) => onChange({ precondition: e.target.value })}
          rows={2}
          placeholder={"1. …\n2. …"}
          className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
        />
      </section>
      <section className="space-y-1.5 border-t border-slate-100 pt-3">
        <h4 className="text-xs font-semibold text-slate-500">步骤</h4>
        <textarea
          value={value.reproSteps}
          onChange={(e) => onChange({ reproSteps: e.target.value })}
          rows={4}
          placeholder={"1. …\n2. …"}
          className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
        />
      </section>
      <section className="space-y-1.5 border-t border-slate-100 pt-3">
        <h4 className="text-xs font-semibold text-slate-500">预期结果</h4>
        <textarea
          value={value.expectedResult}
          onChange={(e) => onChange({ expectedResult: e.target.value })}
          rows={3}
          placeholder="应出现什么提示 / 状态…"
          className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
        />
      </section>
      <section className="space-y-1.5 border-t border-slate-100 pt-3">
        <h4 className="text-xs font-semibold text-slate-500">实际结果</h4>
        <textarea
          value={value.actualResult}
          onChange={(e) => onChange({ actualResult: e.target.value })}
          rows={3}
          placeholder="实际看到了什么…"
          className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
        />
      </section>
    </>
  );
}

function SideLayout({
  left,
  right,
  dense = false,
}: {
  left: ReactNode;
  right: ReactNode;
  /** Peek 分栏内更窄：描述在上、属性在下（避免半屏再横拆挤爆） */
  dense?: boolean;
}) {
  return (
    <div
      className={
        dense
          ? "grid items-start gap-3"
          : "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]"
      }
    >
      <div
        className={
          dense
            ? "min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3"
            : "min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4"
        }
      >
        {left}
      </div>
      <aside
        className={
          dense
            ? "space-y-3"
            : "space-y-3 lg:sticky lg:top-3 lg:self-start"
        }
      >
        {right}
      </aside>
    </div>
  );
}

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(raw: string) {
  const t = raw.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function RequirementPicker({
  value,
  onChange,
  requirements,
}: {
  value: string;
  onChange: (id: string) => void;
  requirements: BugFormOption[];
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return requirements.slice(0, 80);
    return requirements
      .filter((r) => r.title.toLowerCase().includes(needle) || r.id.includes(needle))
      .slice(0, 80);
  }, [requirements, q]);

  const selected = requirements.find((r) => r.id === value);

  return (
    <label className="block space-y-1">
      <span className="text-slate-500">关联需求</span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索需求标题…"
        className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
      >
        <option value="">无</option>
        {selected && !filtered.some((r) => r.id === selected.id) ? (
          <option value={selected.id}>
            {selected.title}
            {selected.inPool ? "（池）" : ""}
          </option>
        ) : null}
        {filtered.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title}
            {r.inPool ? "（池）" : ""}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-slate-400">
        含需求池与看板共 {requirements.length} 条
        {q.trim() ? ` · 匹配 ${filtered.length}` : ""}
      </p>
    </label>
  );
}

function TestPlanPicker({
  projectId,
  projectSlug,
  value,
  onChange,
  plans,
  onPlanCreated,
}: {
  projectId: string;
  projectSlug: string;
  value: string;
  onChange: (id: string) => void;
  plans: BugTestPlan[];
  onPlanCreated?: (plan: BugTestPlan) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const [hint, setHint] = useState<string | null>(null);

  function createPlan() {
    const title = newTitle.trim();
    if (!title) return;
    startTransition(async () => {
      try {
        const plan = await createBugTestPlanAction({
          projectId,
          projectSlug,
          title,
        });
        setNewTitle("");
        onChange(plan.id);
        onPlanCreated?.(plan);
        setHint("已新建并选中");
        setTimeout(() => setHint(null), 2000);
      } catch (error) {
        setHint(error instanceof Error ? error.message : "新建失败");
      }
    });
  }

  return (
    <div className="space-y-1">
      <span className="text-slate-500">测试计划</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
      >
        <option value="">无</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
            {p.status === "archived" ? "（已归档）" : ""}
          </option>
        ))}
      </select>
      <div className="flex gap-1">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="新建如 TP-文件备份"
          className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              createPlan();
            }
          }}
        />
        <button
          type="button"
          disabled={pending || !newTitle.trim()}
          onClick={createPlan}
          className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? "…" : "新建"}
        </button>
      </div>
      {hint ? <p className="text-[10px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function MetaSelects({
  value,
  onChange,
  members,
  requirements,
  featureModules = [],
  testPlans = [],
  iterations = [],
  projectId,
  projectSlug,
  onPlanCreated,
  showStatus,
  reporterReadOnly = true,
}: {
  value: SharedFields;
  onChange: (patch: Partial<SharedFields>) => void;
  members: MemberOption[];
  requirements: BugFormOption[];
  featureModules?: string[];
  testPlans?: BugTestPlan[];
  iterations?: Iteration[];
  projectId: string;
  projectSlug: string;
  onPlanCreated?: (plan: BugTestPlan) => void;
  showStatus?: boolean;
  reporterReadOnly?: boolean;
}) {
  const roster = useMemo(() => assigneeRosterNames(members.map((m) => m.name)), [members]);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="mb-2 text-xs font-semibold text-slate-500">基本信息</h3>
      <div className="space-y-2 text-sm">
        {showStatus ? (
          <label className="flex items-center justify-between gap-2">
            <span className="shrink-0 text-slate-500">状态</span>
            <select
              value={value.status}
              onChange={(e) => onChange({ status: e.target.value as TaskStatus })}
              className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-slate-500">期</span>
          <select
            value={value.iterationId}
            onChange={(e) => onChange({ iterationId: e.target.value })}
            className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1"
            title="关联规划迭代"
          >
            <option value="">未选期</option>
            {iterations.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-slate-500">优先级</span>
          <select
            value={value.priority}
            onChange={(e) =>
              onChange({ priority: (e.target.value || "") as BugPriority | "" })
            }
            className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1"
            title="处理先后；与严重程度分开"
          >
            <option value="">未定</option>
            {BUG_PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {BUG_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-slate-500">严重程度</span>
          <select
            value={value.severity}
            onChange={(e) => onChange({ severity: Number(e.target.value) as BugSeverity })}
            className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1"
            title="影响面：致命…轻微；与优先级分开"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {BUG_SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <TestPlanPicker
          projectId={projectId}
          projectSlug={projectSlug}
          value={value.testPlanId}
          onChange={(testPlanId) => onChange({ testPlanId })}
          plans={testPlans}
          onPlanCreated={onPlanCreated}
        />
        <label className="block space-y-1">
          <span className="text-slate-500">功能模块</span>
          <input
            list="bug-feature-modules"
            value={value.modulePath}
            onChange={(e) => onChange({ modulePath: e.target.value })}
            placeholder="与项目板块一致，如 文件备份"
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
          />
          <datalist id="bug-feature-modules">
            {featureModules.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label className="block space-y-1">
          <span className="text-slate-500">发现版本</span>
          <input
            value={value.foundVersion}
            onChange={(e) => onChange({ foundVersion: e.target.value })}
            placeholder="如 NAS客户端重构V1.0 / v1.15.6"
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-slate-500">解决版本</span>
          <input
            value={value.resolvedVersion}
            onChange={(e) => onChange({ resolvedVersion: e.target.value })}
            placeholder="修复所在版本，如 v1.16.0"
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-slate-500">关联执行用例</span>
          <input
            value={value.executionCase}
            onChange={(e) => onChange({ executionCase: e.target.value })}
            placeholder="用例编号或名称（本期自由文本）"
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
          />
        </label>
        <div className="space-y-1">
          <span className="text-slate-500">环境</span>
          <div className="flex flex-wrap gap-1.5">
            {BUG_ENV_OPTIONS.map((tag) => {
              const on = value.environments.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    onChange({ environments: toggleEnv(value.environments, tag) })
                  }
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    on
                      ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-slate-500">Bug 类型</span>
          <BugTypeSelect
            value={value.bugType}
            onChange={(bugType) => onChange({ bugType: bugType as BugType })}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-slate-500">报告人</span>
          {reporterReadOnly ? (
            <span className="min-w-0 flex-1 truncate text-right text-slate-700">
              {value.reporterName || "—"}
            </span>
          ) : (
            <input
              value={value.reporterName}
              onChange={(e) => onChange({ reporterName: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1"
            />
          )}
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-slate-500">更新人</span>
          <span className="min-w-0 flex-1 truncate text-right text-slate-700">
            {value.updatedBy || "—"}
          </span>
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-slate-500">指派</span>
          <select
            value={value.assignee}
            onChange={(e) => onChange({ assignee: e.target.value })}
            className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1"
          >
            <option value="">未指派</option>
            {roster.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1">
          <span className="text-slate-500">关注人</span>
          <div className="flex flex-wrap gap-1.5">
            {roster.map((name) => {
              const on = value.watchers.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() =>
                    onChange({ watchers: toggleEnv(value.watchers, name) })
                  }
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    on
                      ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400">状态变更与新评论会通知关注人</p>
        </div>
        <RequirementPicker
          value={value.requirementId}
          onChange={(requirementId) => onChange({ requirementId })}
          requirements={requirements}
        />
      </div>
    </section>
  );
}

type CreateDraft = { id: string; fields: SharedFields; pendingFiles: File[] };

function newCreateDraft(overrides?: Partial<SharedFields>): CreateDraft {
  return {
    id: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    fields: EMPTY_FIELDS(overrides),
    pendingFiles: [],
  };
}

async function createOneBug(
  projectId: string,
  projectSlug: string,
  fields: SharedFields,
  pendingFiles: File[] = []
) {
  const bug = await createBugAction({
    projectId,
    projectSlug,
    title: fields.title.trim(),
    description: fields.description.trim() || undefined,
    precondition: fields.precondition.trim() || undefined,
    reproSteps: fields.reproSteps.trim() || undefined,
    expectedResult: fields.expectedResult.trim() || undefined,
    actualResult: fields.actualResult.trim() || undefined,
    suggestion: fields.suggestion.trim() || undefined,
    modulePath: fields.modulePath.trim() || null,
    foundVersion: fields.foundVersion.trim() || null,
    resolvedVersion: fields.resolvedVersion.trim() || null,
    environments: fields.environments,
    priority: fields.priority || null,
    assignee: fields.assignee || undefined,
    reporterName: fields.reporterName.trim() || null,
    updatedBy: fields.reporterName.trim() || PRODUCT_ASSIGNEE_NAME,
    watchers: fields.watchers,
    requirementId: fields.requirementId || null,
    testPlanId: fields.testPlanId || null,
    executionCase: fields.executionCase.trim() || null,
    iterationId: fields.iterationId || null,
    severity: fields.severity,
    bugType: fields.bugType,
  });
  if (pendingFiles.length) {
    await uploadBugPendingFiles(projectId, bug.id, pendingFiles);
  }
  return bug;
}

/** 飞书风格弹窗：可多条草稿一次提交，或勾选连续创建 */
export function BugCreateModal({
  open,
  onClose,
  projectId,
  projectSlug,
  members,
  requirements,
  featureModules = [],
  testPlans: initialTestPlans = [],
  iterations = [],
  currentUserName = PRODUCT_ASSIGNEE_NAME,
  initialRequirementId = "",
  initialTitle = "",
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectSlug: string;
  members: MemberOption[];
  requirements: BugFormOption[];
  featureModules?: string[];
  testPlans?: BugTestPlan[];
  iterations?: Iteration[];
  currentUserName?: string;
  initialRequirementId?: string;
  initialTitle?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [testPlans, setTestPlans] = useState(initialTestPlans);
  const [continuous, setContinuous] = useState(true);
  const seedDefaults = (): Partial<SharedFields> => ({
    title: initialTitle,
    requirementId: initialRequirementId,
    reporterName: currentUserName,
  });
  const [drafts, setDrafts] = useState<CreateDraft[]>(() => [
    newCreateDraft(seedDefaults()),
  ]);
  const [activeId, setActiveId] = useState(() => drafts[0]!.id);

  useEffect(() => {
    if (!open) return;
    const seed = newCreateDraft(seedDefaults());
    setDrafts([seed]);
    setActiveId(seed.id);
    setMessage(null);
    setTestPlans(initialTestPlans);
    // 仅在打开弹窗时灌入初始值，避免输入过程被父级 refresh 冲掉
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed on open
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  const active = drafts.find((d) => d.id === activeId) ?? drafts[0];
  const titledCount = drafts.filter((d) => d.fields.title.trim()).length;

  function patchActive(p: Partial<SharedFields>) {
    if (!active) return;
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === active.id ? { ...d, fields: { ...d.fields, ...p } } : d
      )
    );
  }

  function setActivePendingFiles(files: File[]) {
    if (!active) return;
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === active.id
          ? { ...d, pendingFiles: [...d.pendingFiles, ...files] }
          : d
      )
    );
  }

  function removeActivePendingFile(index: number) {
    if (!active) return;
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === active.id
          ? {
              ...d,
              pendingFiles: d.pendingFiles.filter((_, i) => i !== index),
            }
          : d
      )
    );
  }

  function addDraft() {
    const next = newCreateDraft({
      requirementId: initialRequirementId,
      reporterName: currentUserName,
      severity: active?.fields.severity ?? 3,
      priority: active?.fields.priority ?? "",
      bugType: active?.fields.bugType ?? "code",
      modulePath: active?.fields.modulePath ?? "",
      testPlanId: active?.fields.testPlanId ?? "",
      iterationId: active?.fields.iterationId ?? "",
      environments: active?.fields.environments ?? [],
      assignee: active?.fields.assignee ?? "",
      watchers: active?.fields.watchers ?? [],
    });
    setDrafts((prev) => [...prev, next]);
    setActiveId(next.id);
  }

  function removeDraft(id: string) {
    setDrafts((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((d) => d.id !== id);
      if (activeId === id) setActiveId(next[0]!.id);
      return next;
    });
  }

  function submit() {
    const ready = drafts.filter((d) => d.fields.title.trim());
    if (ready.length === 0) {
      setMessage("请至少填一条标题");
      return;
    }
    startTransition(async () => {
      try {
        const created = [];
        for (const d of ready) {
          created.push(
            await createOneBug(
              projectId,
              projectSlug,
              { ...d.fields, reporterName: d.fields.reporterName || currentUserName },
              d.pendingFiles
            )
          );
        }
        setMessage(`已创建 ${created.length} 条`);
        router.refresh();
        if (continuous) {
          const seed = newCreateDraft({
            requirementId: initialRequirementId,
            reporterName: currentUserName,
            severity: ready[0]?.fields.severity ?? 3,
            priority: ready[0]?.fields.priority ?? "",
            bugType: ready[0]?.fields.bugType ?? "code",
            modulePath: ready[0]?.fields.modulePath ?? "",
            testPlanId: ready[0]?.fields.testPlanId ?? "",
            iterationId: ready[0]?.fields.iterationId ?? "",
            environments: ready[0]?.fields.environments ?? [],
            assignee: ready[0]?.fields.assignee ?? "",
            watchers: ready[0]?.fields.watchers ?? [],
          });
          setDrafts([seed]);
          setActiveId(seed.id);
        } else {
          onClose();
          const last = created[created.length - 1];
          if (last) router.push(`/projects/${projectSlug}/bugs/${last.id}`);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "提交失败");
      }
    });
  }

  if (!open || !active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-3 pt-[5vh] sm:p-6 sm:pt-[6vh]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="关闭遮罩"
        onClick={() => !pending && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-create-modal-title"
        className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2
              id="bug-create-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              缺陷
            </h2>
            <p className="text-[11px] text-slate-400">
              可一次填多条；勾选连续创建则提交后继续开窗
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-3 py-2 sm:px-4">
          {drafts.map((d, i) => {
            const label = d.fields.title.trim() || `第 ${i + 1} 条`;
            const activeTab = d.id === active.id;
            return (
              <div key={d.id} className="inline-flex max-w-[11rem] items-center">
                <button
                  type="button"
                  onClick={() => setActiveId(d.id)}
                  className={`truncate rounded-l-lg px-2.5 py-1 text-xs ${
                    activeTab
                      ? "bg-white font-medium text-indigo-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white/80"
                  }`}
                  title={label}
                >
                  {label}
                </button>
                {drafts.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeDraft(d.id)}
                    className={`rounded-r-lg px-1.5 py-1 text-xs ${
                      activeTab
                        ? "bg-white text-slate-400 ring-1 ring-slate-200 hover:text-rose-600"
                        : "text-slate-400 hover:text-rose-600"
                    }`}
                    aria-label={`删除第 ${i + 1} 条`}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
          <button
            type="button"
            onClick={addDraft}
            className="rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
          >
            + 再加一条
          </button>
        </div>

        <div className="max-h-[min(70vh,720px)] overflow-y-auto px-4 py-4 sm:px-5">
          <SideLayout
            left={
              <>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-500">
                    缺陷名称 <span className="text-rose-500">*</span>
                  </span>
                  <input
                    value={active.fields.title}
                    onChange={(e) => patchActive({ title: e.target.value })}
                    placeholder="一句话说清问题"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base font-semibold text-slate-900 outline-none focus:border-indigo-300"
                    autoFocus
                  />
                </label>
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-slate-500">缺陷描述</p>
                  <ReproTemplateFields value={active.fields} onChange={patchActive} />
                </div>
                <section className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                  <h4 className="text-xs font-semibold text-slate-500">补充说明</h4>
                  <textarea
                    value={active.fields.description}
                    onChange={(e) => patchActive({ description: e.target.value })}
                    rows={2}
                    placeholder="影响范围、其它上下文（可选）…"
                    className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
                  />
                </section>
                <section className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                  <h4 className="text-xs font-semibold text-slate-500">优化建议</h4>
                  <textarea
                    value={active.fields.suggestion}
                    onChange={(e) => patchActive({ suggestion: e.target.value })}
                    rows={2}
                    placeholder="给 +1 / 研发的建议（可选）…"
                    className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
                  />
                </section>
                <section className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <h4 className="text-xs font-semibold text-slate-500">截图 / 附件</h4>
                  <ImageDropZone
                    multiple
                    disabled={pending}
                    onFiles={setActivePendingFiles}
                    className="py-3 text-center"
                  >
                    拖拽或点击添加；创建后自动上传
                  </ImageDropZone>
                  {active.pendingFiles.length > 0 ? (
                    <ul className="space-y-1 text-xs text-slate-600">
                      {active.pendingFiles.map((f, i) => (
                        <li
                          key={`${f.name}-${i}`}
                          className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1"
                        >
                          <span className="truncate">{f.name}</span>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => removeActivePendingFile(i)}
                            className="shrink-0 text-rose-600"
                          >
                            删
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-slate-400">可选；提交后写入该条 Bug</p>
                  )}
                </section>
              </>
            }
            right={
              <MetaSelects
                value={active.fields}
                onChange={patchActive}
                members={members}
                requirements={requirements}
                featureModules={featureModules}
                testPlans={testPlans}
                iterations={iterations}
                projectId={projectId}
                projectSlug={projectSlug}
                onPlanCreated={(plan) =>
                  setTestPlans((prev) =>
                    prev.some((p) => p.id === plan.id) ? prev : [plan, ...prev]
                  )
                }
              />
            }
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
          <label className="inline-flex items-center gap-1.5 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={continuous}
              onChange={(e) => setContinuous(e.target.checked)}
            />
            连续创建
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {message ? (
              <span className="text-xs text-slate-500">{message}</span>
            ) : (
              <span className="text-xs text-slate-400">
                将创建 {titledCount} 条
                {drafts.length > titledCount
                  ? `（另有 ${drafts.length - titledCount} 条无标题跳过）`
                  : ""}
              </span>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={pending || titledCount === 0}
              onClick={submit}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending
                ? "创建中…"
                : titledCount > 1
                  ? `确认创建 ${titledCount} 条`
                  : "确认创建"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated 使用 BugCreateModal；保留别名以免旧引用报错 */
export function BugCreateForm(
  props: Omit<Parameters<typeof BugCreateModal>[0], "open" | "onClose"> & {
    open?: boolean;
    onClose?: () => void;
  }
) {
  return (
    <BugCreateModal
      {...props}
      open={props.open ?? true}
      onClose={props.onClose ?? (() => undefined)}
    />
  );
}

export function BugDetailEditor({
  bug,
  projectId,
  projectSlug,
  projectName,
  requirementTitle,
  members,
  requirements,
  featureModules = [],
  testPlans: initialTestPlans = [],
  iterations = [],
  comments,
  attachments = [],
  learningOptions = [],
  competitorOptions = [],
  variant = "page",
  onClose,
}: {
  bug: Bug;
  projectId: string;
  projectSlug: string;
  projectName: string;
  requirementTitle?: string | null;
  members: MemberOption[];
  requirements: BugFormOption[];
  featureModules?: string[];
  testPlans?: BugTestPlan[];
  iterations?: Iteration[];
  comments: BugComment[];
  attachments?: BugAttachment[];
  learningOptions?: CrossLinkOption[];
  competitorOptions?: CrossLinkOption[];
  /** page=独立全页；peek=列表分栏右栏（约定：左列表右详情） */
  variant?: "page" | "peek";
  onClose?: () => void;
}) {
  const isPeek = variant === "peek";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [testPlans, setTestPlans] = useState(initialTestPlans);
  const [linkedLearningIds, setLinkedLearningIds] = useState<string[]>(
    () => bug.linked_learning_note_ids ?? []
  );
  const [linkedCompetitorIds, setLinkedCompetitorIds] = useState<string[]>(
    () => bug.linked_competitor_ids ?? []
  );
  const [peek, setPeek] = useState<EntityPeekPayload | null>(null);
  const [peekPending, setPeekPending] = useState(false);
  const [fields, setFields] = useState<SharedFields>(() =>
    EMPTY_FIELDS({
      title: bug.title,
      precondition: bug.precondition ?? "",
      reproSteps: bug.repro_steps ?? "",
      expectedResult: bug.expected_result ?? "",
      actualResult: bug.actual_result ?? "",
      description: bug.description ?? "",
      suggestion: bug.suggestion ?? "",
      modulePath: bug.module_path ?? "",
      foundVersion: bug.found_version ?? "",
      resolvedVersion: bug.resolved_version ?? "",
      environments: bug.environments ?? [],
      priority: bug.priority ?? "",
      severity: bug.severity ?? 3,
      bugType: bug.bug_type ?? "code",
      assignee: bug.assignee ?? "",
      reporterName: bug.reporter_name ?? "",
      updatedBy: bug.updated_by ?? "",
      watchers: bug.watchers ?? [],
      requirementId: bug.requirement_id ?? "",
      testPlanId: bug.test_plan_id ?? "",
      executionCase: bug.execution_case ?? "",
      iterationId: bug.iteration_id ?? "",
      status: bug.status,
    })
  );

  useEffect(() => {
    setLinkedLearningIds(bug.linked_learning_note_ids ?? []);
    setLinkedCompetitorIds(bug.linked_competitor_ids ?? []);
  }, [bug.id, bug.linked_learning_note_ids, bug.linked_competitor_ids]);
  const [createdAtLocal, setCreatedAtLocal] = useState(() =>
    toDatetimeLocalValue(bug.created_at)
  );
  const [updatedAtLocal, setUpdatedAtLocal] = useState(() =>
    toDatetimeLocalValue(bug.updated_at)
  );
  const roster = useMemo(() => assigneeRosterNames(members.map((m) => m.name)), [members]);
  const [commentAuthor, setCommentAuthor] = useState(PRODUCT_ASSIGNEE_NAME);
  const [commentBody, setCommentBody] = useState("");

  const resolved = useMemo(
    () => fields.status === "done" || fields.status === "acceptance",
    [fields.status]
  );

  const bugPath = `/projects/${projectSlug}/bugs/${bug.id}`;

  function patch(p: Partial<SharedFields>) {
    setFields((prev) => ({ ...prev, ...p }));
  }

  function bugAbsoluteUrl() {
    if (typeof window === "undefined") return bugPath;
    return `${window.location.origin}${bugPath}`;
  }

  async function copyBugLink() {
    try {
      const url = bugAbsoluteUrl();
      await navigator.clipboard.writeText(url);
      setCopyHint("已复制链接");
      setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setCopyHint("复制失败，请手动选中地址栏");
    }
  }

  function save() {
    startTransition(async () => {
      try {
        const createdChanged =
          createdAtLocal !== toDatetimeLocalValue(bug.created_at);
        const updatedChanged =
          updatedAtLocal !== toDatetimeLocalValue(bug.updated_at);
        await updateBugAction({
          bugId: bug.id,
          projectSlug,
          updates: {
            title: fields.title.trim(),
            description: fields.description.trim() || null,
            precondition: fields.precondition.trim() || null,
            reproSteps: fields.reproSteps.trim() || null,
            expectedResult: fields.expectedResult.trim() || null,
            actualResult: fields.actualResult.trim() || null,
            suggestion: fields.suggestion.trim() || null,
            modulePath: fields.modulePath.trim() || null,
            foundVersion: fields.foundVersion.trim() || null,
            resolvedVersion: fields.resolvedVersion.trim() || null,
            environments: fields.environments,
            priority: fields.priority || null,
            assignee: fields.assignee || null,
            updatedBy: PRODUCT_ASSIGNEE_NAME,
            watchers: fields.watchers,
            requirementId: fields.requirementId || null,
            testPlanId: fields.testPlanId || null,
            executionCase: fields.executionCase.trim() || null,
            iterationId: fields.iterationId || null,
            status: fields.status,
            severity: fields.severity,
            bugType: fields.bugType,
            createdAt: createdChanged ? fromDatetimeLocalValue(createdAtLocal) : undefined,
            updatedAt: updatedChanged ? fromDatetimeLocalValue(updatedAtLocal) : undefined,
          },
        });
        setMessage("已保存");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      }
    });
  }

  function setStatus(status: TaskStatus) {
    startTransition(async () => {
      await updateBugStatusAction({ bugId: bug.id, projectSlug, status });
      patch({ status });
      router.refresh();
    });
  }

  function setCrossLinks(
    field: "linkedLearningNoteIds" | "linkedCompetitorIds",
    ids: string[]
  ) {
    startTransition(async () => {
      try {
        await updateBugAction({
          bugId: bug.id,
          projectSlug,
          updates: { [field]: ids },
        });
        if (field === "linkedLearningNoteIds") setLinkedLearningIds(ids);
        else setLinkedCompetitorIds(ids);
        setMessage("已更新关联");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "关联失败");
      }
    });
  }

  function openPeek(opt: CrossLinkOption) {
    setPeek({
      kind: opt.kind ?? "learning",
      id: opt.id,
      title: opt.title,
      href: opt.href,
      badge: opt.badge,
      fields: (opt.fields ?? []).map((f, i) => ({
        key: f.key ?? `f${i}`,
        label: f.label,
        value: f.value,
        multiline: f.multiline,
      })),
    });
  }

  async function savePeek(patch: {
    title: string;
    fields: Record<string, string>;
  }) {
    if (!peek) return;
    setPeekPending(true);
    try {
      if (peek.kind === "learning") {
        await updateLearningNoteAction({
          noteId: peek.id,
          projectSlug,
          title: patch.title,
          whyText: patch.fields.why_text,
          principle: patch.fields.principle,
          protocol: patch.fields.protocol,
        });
      } else if (peek.kind === "competitor") {
        await updateCompetitorEntryAction({
          entryId: peek.id,
          projectSlug,
          title: patch.title,
          summary: patch.fields.summary,
          url: patch.fields.url || null,
        });
      }
      setMessage("已保存关联详情");
      setPeek(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "侧栏保存失败");
    } finally {
      setPeekPending(false);
    }
  }

  function submitComment() {
    if (!commentBody.trim()) return;
    startTransition(async () => {
      try {
        await addBugCommentAction({
          bugId: bug.id,
          projectSlug,
          authorName: commentAuthor,
          body: commentBody.trim(),
        });
        setCommentBody("");
        setMessage("已补充");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "补充失败");
      }
    });
  }

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {message ? <span className="text-xs text-slate-500">{message}</span> : null}
      {copyHint ? <span className="text-xs text-emerald-600">{copyHint}</span> : null}
      <button
        type="button"
        onClick={() => void copyBugLink()}
        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 sm:px-3 sm:py-1.5 sm:text-sm"
      >
        复制链接
      </button>
      <a
        href={bugPath}
        target="_blank"
        rel="noreferrer"
        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 sm:px-3 sm:py-1.5 sm:text-sm"
        title="独立全页打开（分享/新标签）"
      >
        {isPeek ? "↗ 全页" : "打开链接"}
      </a>
      {!resolved ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("done")}
          className="rounded-lg border border-emerald-200 px-2.5 py-1 text-xs text-emerald-700 sm:px-3 sm:py-1.5 sm:text-sm"
        >
          解决
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setStatus("pending")}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 sm:px-3 sm:py-1.5 sm:text-sm"
        >
          重开
        </button>
      )}
      <button
        type="button"
        disabled={pending || !fields.title.trim()}
        onClick={save}
        className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50 sm:px-3 sm:py-1.5 sm:text-sm"
      >
        {pending ? "保存中…" : "保存"}
      </button>
    </div>
  );

  const body = (
    <SideLayout
      dense={isPeek}
      left={
        <>
          <input
            value={fields.title}
            onChange={(e) => patch({ title: e.target.value })}
            className="w-full border-0 bg-transparent text-xl font-bold text-slate-900 outline-none"
          />
          <ReproTemplateFields value={fields} onChange={patch} />
          <BugAttachmentsBlock
            projectId={bug.project_id}
            bugId={bug.id}
            attachments={attachments}
            variant="inline"
          />
          <section className="space-y-1.5 border-t border-slate-100 pt-3">
            <h4 className="text-xs font-semibold text-slate-500">补充说明</h4>
            <textarea
              value={fields.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={3}
              placeholder="影响范围、其它上下文（可选）…"
              className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
            />
          </section>
          <section className="space-y-1.5 border-t border-slate-100 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-slate-500">优化建议</h4>
              <button
                type="button"
                disabled={
                  pending ||
                  !fields.suggestion.trim() ||
                  Boolean(fields.requirementId || bug.requirement_id)
                }
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const r = await generateRequirementFromBugSuggestionAction({
                        bugId: bug.id,
                        projectId,
                        projectSlug,
                      });
                      if (r.requirementId) {
                        patch({ requirementId: r.requirementId });
                      }
                      setMessage(
                        r.created
                          ? "已从优化建议生成需求"
                          : "该 Bug 已关联需求"
                      );
                      router.refresh();
                    } catch (error) {
                      setMessage(
                        error instanceof Error ? error.message : "生成失败"
                      );
                    }
                  });
                }}
                className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 disabled:opacity-40"
              >
                一键生成需求
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              优化表导入会写入此处；生成需求后自动挂到本 Bug。
            </p>
            <textarea
              value={fields.suggestion}
              onChange={(e) => patch({ suggestion: e.target.value })}
              rows={3}
              placeholder="给 +1 / 研发的建议（可选）…"
              className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
            />
            {(fields.requirementId || bug.requirement_id) && (
              <a
                href={`/projects/${projectSlug}/requirements/${fields.requirementId || bug.requirement_id}`}
                className="inline-block text-xs text-indigo-600 hover:underline"
              >
                已关联需求 →
              </a>
            )}
          </section>
          <section className="space-y-2 border-t border-slate-100 pt-3">
            <h4 className="text-xs font-semibold text-slate-500">补充与评论</h4>
            {comments.length === 0 ? (
              <p className="text-xs text-slate-400">还没有补充。不同人都可以在下面留言。</p>
            ) : (
              <ul className="space-y-2">
                {comments.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
                  >
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{c.author_name}</span>
                      <span>{new Date(c.created_at).toLocaleString("zh-CN")}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-slate-800">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2 rounded-lg border border-dashed border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>作者</span>
                  <select
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    className="rounded-md border border-slate-200 px-2 py-1"
                  >
                    {roster.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={3}
                placeholder="补充现象、截图说明、处理进展…"
                className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-300"
              />
              <button
                type="button"
                disabled={pending || !commentBody.trim()}
                onClick={submitComment}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 disabled:opacity-50"
              >
                发表补充
              </button>
            </div>
          </section>
        </>
      }
      right={
        <>
          <MetaSelects
            value={fields}
            onChange={patch}
            members={members}
            requirements={requirements}
            featureModules={featureModules}
            testPlans={testPlans}
            iterations={iterations}
            projectId={projectId}
            projectSlug={projectSlug}
            onPlanCreated={(plan) =>
              setTestPlans((prev) =>
                prev.some((p) => p.id === plan.id) ? prev : [plan, ...prev]
              )
            }
            showStatus
          />
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="mb-1 text-xs font-semibold text-slate-500">
              交叉关联
            </h3>
            <p className="mb-2 text-[10px] text-slate-400">
              与学习 / 竞品互相引用；总表导入也可挂上
            </p>
            <CrossLinkSection
              title="关联学习"
              linkedIds={linkedLearningIds}
              options={learningOptions}
              pending={pending}
              pickPlaceholder="选择学习笔记…"
              onLink={(id) =>
                setCrossLinks("linkedLearningNoteIds", [
                  ...linkedLearningIds,
                  id,
                ])
              }
              onUnlink={(id) =>
                setCrossLinks(
                  "linkedLearningNoteIds",
                  linkedLearningIds.filter((x) => x !== id)
                )
              }
              onOpen={openPeek}
            />
            <CrossLinkSection
              title="关联竞品条目"
              linkedIds={linkedCompetitorIds}
              options={competitorOptions}
              pending={pending}
              pickPlaceholder="选择竞品条目…"
              onLink={(id) =>
                setCrossLinks("linkedCompetitorIds", [
                  ...linkedCompetitorIds,
                  id,
                ])
              }
              onUnlink={(id) =>
                setCrossLinks(
                  "linkedCompetitorIds",
                  linkedCompetitorIds.filter((x) => x !== id)
                )
              }
              onOpen={openPeek}
            />
          </section>
          {peek ? (
            <EntitySidePeek
              item={peek}
              pending={peekPending}
              onClose={() => setPeek(null)}
              onSave={
                peek.kind === "learning" || peek.kind === "competitor"
                  ? savePeek
                  : undefined
              }
            />
          ) : null}
          <section className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
            <h3 className="mb-2 font-semibold text-slate-500">归属</h3>
            <div className="space-y-1.5 text-slate-700">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">项目</span>
                <span className="text-right">{projectName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">需求</span>
                {fields.requirementId || bug.requirement_id ? (
                  <a
                    href={`/projects/${projectSlug}/requirements/${fields.requirementId || bug.requirement_id}`}
                    className="max-w-[160px] truncate text-right text-indigo-600 hover:underline"
                  >
                    {requirements.find((r) => r.id === (fields.requirementId || bug.requirement_id))
                      ?.title ||
                      requirementTitle ||
                      "查看需求"}
                  </a>
                ) : (
                  <span className="text-slate-400">未关联</span>
                )}
              </div>
            </div>
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-2">
              <label className="block space-y-1">
                <span className="text-slate-500">创建时间</span>
                <input
                  type="datetime-local"
                  value={createdAtLocal}
                  onChange={(e) => setCreatedAtLocal(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-500">更新时间</span>
                <input
                  type="datetime-local"
                  value={updatedAtLocal}
                  onChange={(e) => setUpdatedAtLocal(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                />
              </label>
              <p className="text-[10px] text-slate-400">改完点「保存」写入。指派变更会发站内通知。</p>
            </div>
            <div className="mt-2 border-t border-slate-100 pt-2 text-slate-400">
              链接
              <br />
              <span className="break-all text-[10px] text-slate-500">{bugPath}</span>
            </div>
          </section>
        </>
      }
    />
  );

  if (isPeek) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-white">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
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
              Bug · {TASK_STATUS_LABELS[fields.status] ?? fields.status}
            </span>
          </div>
          {toolbar}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{body}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackLink
          fallback={`/projects/${projectSlug}/bugs`}
          label="← 返回 Bug 列表"
        />
        {toolbar}
      </div>
      {body}
    </div>
  );
}
