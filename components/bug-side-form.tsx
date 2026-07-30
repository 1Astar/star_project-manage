"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addBugCommentAction,
  createBugAction,
  updateBugAction,
  updateBugStatusAction,
} from "@/lib/actions";
import { assigneeRosterNames, PRODUCT_ASSIGNEE_NAME } from "@/lib/assignee-roster";
import type { Bug, BugComment, BugSeverity, BugType, TaskStatus } from "@/lib/types";
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

export type BugFormOption = { id: string; title: string; inPool?: boolean };
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
            {roster.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <RequirementPicker
          value={value.requirementId}
          onChange={(requirementId) => onChange({ requirementId })}
          requirements={requirements}
        />
      </div>
    </section>
  );
}

export function BugCreateForm({
  projectId,
  projectSlug,
  members,
  requirements,
  initialRequirementId = "",
  initialTitle = "",
}: {
  projectId: string;
  projectSlug: string;
  members: MemberOption[];
  requirements: BugFormOption[];
  initialRequirementId?: string;
  initialTitle?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<SharedFields>({
    title: initialTitle,
    reproSteps: "",
    description: "",
    severity: 3,
    bugType: "code",
    assignee: "",
    requirementId: initialRequirementId,
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
  projectName,
  requirementTitle,
  members,
  requirements,
  comments,
}: {
  bug: Bug;
  projectSlug: string;
  projectName: string;
  requirementTitle?: string | null;
  members: MemberOption[];
  requirements: BugFormOption[];
  comments: BugComment[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
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
            reproSteps: fields.reproSteps.trim() || null,
            assignee: fields.assignee || null,
            requirementId: fields.requirementId || null,
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

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a
          href={`/projects/${projectSlug}/bugs`}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← 返回 Bug 列表
        </a>
        <div className="flex flex-wrap items-center gap-2">
          {message ? <span className="text-xs text-slate-500">{message}</span> : null}
          {copyHint ? <span className="text-xs text-emerald-600">{copyHint}</span> : null}
          <button
            type="button"
            onClick={() => void copyBugLink()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            复制链接
          </button>
          <a
            href={bugPath}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            打开链接
          </a>
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
              showStatus
            />
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
    </div>
  );
}
