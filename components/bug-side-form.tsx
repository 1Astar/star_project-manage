"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBugAction, updateBugAction, updateBugStatusAction } from "@/lib/actions";
import type { Bug, BugSeverity, BugType, TaskStatus } from "@/lib/types";
import {
  BUG_SEVERITY_LABELS,
  BUG_TYPE_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/types";

const STATUS_OPTIONS: TaskStatus[] = [
  "pending",
  "in_progress",
  "testing",
  "acceptance",
  "done",
  "blocked",
];

const SEVERITIES = [1, 2, 3, 4] as BugSeverity[];
const BUG_TYPES = Object.keys(BUG_TYPE_LABELS) as BugType[];

export type BugFormOption = { id: string; title: string };
export type MemberOption = { name: string };

type SharedFields = {
  title: string;
  reproSteps: string;
  description: string;
  severity: BugSeverity;
  bugType: BugType;
  assignee: string;
  requirementId: string;
  status: TaskStatus;
};

function SideLayout({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]">
      <div className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4">{left}</div>
      <aside className="space-y-3 lg:sticky lg:top-3 lg:self-start">{right}</aside>
    </div>
  );
}

function MetaSelects({
  value,
  onChange,
  members,
  requirements,
  showStatus,
}: {
  value: SharedFields;
  onChange: (patch: Partial<SharedFields>) => void;
  members: MemberOption[];
  requirements: BugFormOption[];
  showStatus?: boolean;
}) {
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
          <span className="shrink-0 text-slate-500">严重程度</span>
          <select
            value={value.severity}
            onChange={(e) => onChange({ severity: Number(e.target.value) as BugSeverity })}
            className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {BUG_SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-slate-500">Bug 类型</span>
          <select
            value={value.bugType}
            onChange={(e) => onChange({ bugType: e.target.value as BugType })}
            className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1"
          >
            {BUG_TYPES.map((t) => (
              <option key={t} value={t}>
                {BUG_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-slate-500">指派</span>
          <select
            value={value.assignee}
            onChange={(e) => onChange({ assignee: e.target.value })}
            className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1"
          >
            <option value="">未指派</option>
            {members.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-slate-500">关联需求</span>
          <select
            value={value.requirementId}
            onChange={(e) => onChange({ requirementId: e.target.value })}
            className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
          >
            <option value="">无</option>
            {requirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

export function BugCreateForm({
  projectId,
  projectSlug,
  members,
  requirements,
}: {
  projectId: string;
  projectSlug: string;
  members: MemberOption[];
  requirements: BugFormOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<SharedFields>({
    title: "",
    reproSteps: "",
    description: "",
    severity: 3,
    bugType: "code",
    assignee: "",
    requirementId: "",
    status: "pending",
  });

  function patch(p: Partial<SharedFields>) {
    setFields((prev) => ({ ...prev, ...p }));
  }

  function submit() {
    if (!fields.title.trim()) return;
    startTransition(async () => {
      try {
        const bug = await createBugAction({
          projectId,
          projectSlug,
          title: fields.title.trim(),
          description: fields.description.trim() || undefined,
          reproSteps: fields.reproSteps.trim() || undefined,
          assignee: fields.assignee || undefined,
          requirementId: fields.requirementId || null,
          severity: fields.severity,
          bugType: fields.bugType,
        });
        setFields({
          title: "",
          reproSteps: "",
          description: "",
          severity: 3,
          bugType: "code",
          assignee: "",
          requirementId: "",
          status: "pending",
        });
        setMessage("已提交");
        router.push(`/projects/${projectSlug}/bugs/${bug.id}`);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "提交失败");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">+ 提 Bug</h3>
        <div className="flex items-center gap-2">
          {message ? <span className="text-xs text-slate-500">{message}</span> : null}
          <button
            type="button"
            disabled={pending || !fields.title.trim()}
            onClick={submit}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "提交中…" : "提交"}
          </button>
        </div>
      </div>

      <SideLayout
        left={
          <>
            <input
              value={fields.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Bug 标题"
              className="w-full border-0 bg-transparent text-lg font-bold text-slate-900 outline-none placeholder:text-slate-300"
            />
            <section className="space-y-1.5 border-t border-slate-100 pt-3">
              <h4 className="text-xs font-semibold text-slate-500">重现步骤</h4>
              <textarea
                value={fields.reproSteps}
                onChange={(e) => patch({ reproSteps: e.target.value })}
                rows={5}
                placeholder={"[步骤]\n1. …\n[结果]\n…"}
                className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
              />
            </section>
            <section className="space-y-1.5 border-t border-slate-100 pt-3">
              <h4 className="text-xs font-semibold text-slate-500">描述 / 期望</h4>
              <textarea
                value={fields.description}
                onChange={(e) => patch({ description: e.target.value })}
                rows={4}
                placeholder="期望结果、影响范围…"
                className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
              />
            </section>
          </>
        }
        right={
          <MetaSelects
            value={fields}
            onChange={patch}
            members={members}
            requirements={requirements}
          />
        }
      />
    </div>
  );
}

export function BugDetailEditor({
  bug,
  projectSlug,
  members,
  requirements,
}: {
  bug: Bug;
  projectSlug: string;
  members: MemberOption[];
  requirements: BugFormOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<SharedFields>({
    title: bug.title,
    reproSteps: bug.repro_steps ?? "",
    description: bug.description ?? "",
    severity: bug.severity ?? 3,
    bugType: bug.bug_type ?? "code",
    assignee: bug.assignee ?? "",
    requirementId: bug.requirement_id ?? "",
    status: bug.status,
  });

  const resolved = useMemo(
    () => fields.status === "done" || fields.status === "acceptance",
    [fields.status]
  );

  function patch(p: Partial<SharedFields>) {
    setFields((prev) => ({ ...prev, ...p }));
  }

  function save() {
    startTransition(async () => {
      try {
        await updateBugAction({
          bugId: bug.id,
          projectSlug,
          updates: {
            title: fields.title.trim(),
            description: fields.description.trim() || null,
            reproSteps: fields.reproSteps.trim() || null,
            assignee: fields.assignee || null,
            requirementId: fields.requirementId || null,
            status: fields.status,
            severity: fields.severity,
            bugType: fields.bugType,
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

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a
          href={`/projects/${projectSlug}/bugs`}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← 返回 Bug 列表
        </a>
        <div className="flex items-center gap-2">
          {message ? <span className="text-xs text-slate-500">{message}</span> : null}
          {!resolved ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus("done")}
              className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm text-emerald-700"
            >
              解决
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus("pending")}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600"
            >
              重开
            </button>
          )}
          <button
            type="button"
            disabled={pending || !fields.title.trim()}
            onClick={save}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      <SideLayout
        left={
          <>
            <input
              value={fields.title}
              onChange={(e) => patch({ title: e.target.value })}
              className="w-full border-0 bg-transparent text-xl font-bold text-slate-900 outline-none"
            />
            <section className="space-y-1.5 border-t border-slate-100 pt-3">
              <h4 className="text-xs font-semibold text-slate-500">重现步骤</h4>
              <textarea
                value={fields.reproSteps}
                onChange={(e) => patch({ reproSteps: e.target.value })}
                rows={6}
                className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
              />
            </section>
            <section className="space-y-1.5 border-t border-slate-100 pt-3">
              <h4 className="text-xs font-semibold text-slate-500">描述 / 期望</h4>
              <textarea
                value={fields.description}
                onChange={(e) => patch({ description: e.target.value })}
                rows={4}
                className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm outline-none focus:border-indigo-300 focus:bg-white"
              />
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
              showStatus
            />
            <section className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
              <div>创建 {new Date(bug.created_at).toLocaleString("zh-CN")}</div>
              <div className="mt-1">更新 {new Date(bug.updated_at).toLocaleString("zh-CN")}</div>
            </section>
          </>
        }
      />
    </div>
  );
}
