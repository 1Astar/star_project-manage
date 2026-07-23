"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createPoolRequirementAction,
  deletePoolRequirementAction,
  deletePoolRequirementsAction,
  dedupePoolRequirementsAction,
  forceCloseRequirementAction,
  migratePoolRequirementsAction,
  promotePoolRequirementAction,
  saveRequirementDetailAction,
} from "@/lib/actions";
import { RequirementMemoryTimeline, type TimelineEntity } from "@/components/requirement-memory-timeline";
import { RequirementPoolTable } from "@/components/requirement-pool-table";
import { StudioBadge } from "@/components/studio/shell";
import type {
  Iteration,
  ModuleNode,
  PoolColumnDef,
  ProjectMember,
  Requirement,
  RequirementAttachment,
  RequirementLink,
  RequirementType,
} from "@/lib/types";
import { requirementIsDone } from "@/lib/types";
import { cn } from "@/lib/utils";

const REQ_SOURCE_OPTIONS = [
  "客户",
  "用户",
  "产品经理",
  "市场",
  "客服",
  "运营",
  "技术支持",
  "竞争对手",
  "合作伙伴",
  "自己",
];

type Props = {
  projectId: string;
  projectSlug: string;
  requirements: Requirement[];
  modules?: ModuleNode[];
  activeIterations: Iteration[];
  attachments: RequirementAttachment[];
  members: ProjectMember[];
  columnDefs?: PoolColumnDef[];
  tagOptions?: string[];
  links?: RequirementLink[];
  timelineEntities?: TimelineEntity[];
  initialReqId?: string | null;
};

function isImage(mime: string | null, url: string) {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
}

export function RequirementPoolSplitView({
  projectId,
  projectSlug,
  requirements: initialReqs,
  modules = [],
  activeIterations,
  attachments: initialAttachments,
  members,
  columnDefs = [],
  tagOptions = [],
  links: initialLinks = [],
  timelineEntities = [],
  initialReqId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requirements, setRequirements] = useState(initialReqs);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [links, setLinks] = useState(initialLinks);
  const [drawerReqId, setDrawerReqId] = useState<string | null>(
    initialReqId && initialReqs.some((r) => r.id === initialReqId) ? initialReqId : null
  );
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setRequirements(initialReqs);
    setAttachments(initialAttachments);
    setLinks(initialLinks);
  }, [initialReqs, initialAttachments, initialLinks]);

  useEffect(() => {
    if (initialReqId && initialReqs.some((r) => r.id === initialReqId)) {
      setDrawerReqId(initialReqId);
    }
  }, [initialReqId, initialReqs]);

  const drawerReq = useMemo(
    () => (drawerReqId ? requirements.find((r) => r.id === drawerReqId) ?? null : null),
    [drawerReqId, requirements]
  );

  const drawerAttachments = useMemo(
    () => attachments.filter((a) => a.requirement_id === drawerReqId),
    [attachments, drawerReqId]
  );

  function openReq(id: string) {
    setDrawerReqId(id);
    const params = new URLSearchParams(window.location.search);
    params.set("req", id);
    params.delete("view");
    router.replace(`/projects/${projectSlug}/tasks?${params.toString()}`, { scroll: false });
  }

  function closeDrawer() {
    setDrawerReqId(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("req");
    const qs = params.toString();
    router.replace(qs ? `/projects/${projectSlug}/tasks?${qs}` : `/projects/${projectSlug}/tasks`, {
      scroll: false,
    });
  }

  function addRow(parentId?: string | null) {
    startTransition(async () => {
      const result = await createPoolRequirementAction(projectSlug, projectId, {
        parentId: parentId ?? null,
        title: parentId ? "子需求" : "新功能点",
      });
      if (result?.requirement) {
        setRequirements((prev) => [...prev, result.requirement]);
        openReq(result.id);
      }
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">需求（灵感）</h2>
          <p className="text-xs text-slate-500">
            勾选多删 · 行拖「⋮⋮」· 表头拖列序 ·「打开」看详情 ·「+子」拆层级 ·「全部展开/收起」
          </p>
        </div>
        <div className="flex items-center gap-2">
          {message ? <span className="text-xs text-slate-500">{message}</span> : null}
          <button
            type="button"
            disabled={pending}
            onClick={() => addRow(null)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            + 提需求
          </button>
        </div>
      </div>

      <div
        className={cn(
          "grid min-h-[420px]",
          drawerReq ? "lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.15fr)]" : "grid-cols-1"
        )}
      >
        <RequirementPoolTable
          projectId={projectId}
          projectSlug={projectSlug}
          requirements={requirements}
          modules={modules}
          attachments={attachments}
          columnDefs={columnDefs}
          tagOptions={tagOptions}
          drawerReqId={drawerReqId}
          pending={pending}
          onOpenReq={openReq}
          onOpenLightbox={(url) => setLightbox(url)}
          onAddChild={(parentId) => addRow(parentId)}
          onBulkDelete={(ids) => {
            startTransition(async () => {
              try {
                await deletePoolRequirementsAction(ids, projectSlug);
                setRequirements((prev) => prev.filter((r) => !ids.includes(r.id)));
                if (drawerReqId && ids.includes(drawerReqId)) closeDrawer();
                setMessage(`已删除 ${ids.length} 条`);
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "删除失败");
              }
            });
          }}
          onBulkMigrate={({
            requirementIds,
            targetProjectId,
            targetIterationId,
            targetProjectSlug,
          }) => {
            startTransition(async () => {
              try {
                const result = await migratePoolRequirementsAction({
                  requirementIds,
                  targetProjectId,
                  targetIterationId,
                  sourceProjectSlug: projectSlug,
                  targetProjectSlug,
                });
                setRequirements((prev) => prev.filter((r) => !result.ids.includes(r.id)));
                if (drawerReqId && result.ids.includes(drawerReqId)) closeDrawer();
                setMessage(`已迁移 ${result.moved} 条`);
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "迁移失败");
              }
            });
          }}
          onDedupe={() => {
            startTransition(async () => {
              try {
                const result = await dedupePoolRequirementsAction(projectId, projectSlug);
                setMessage(`已清理重复 ${result.deleted} 条`);
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "清理失败");
              }
            });
          }}
          onInlineSave={(requirementId, updates) => {
            startTransition(async () => {
              try {
                await saveRequirementDetailAction({
                  requirementId,
                  projectSlug,
                  updates,
                });
                setRequirements((prev) =>
                  prev.map((r) => {
                    if (r.id !== requirementId) return r;
                    const next = {
                      ...r,
                      ...updates,
                      updated_at: new Date().toISOString(),
                    } as Requirement;
                    if (updates.custom_fields) {
                      next.custom_fields = {
                        ...(r.custom_fields ?? {}),
                        ...updates.custom_fields,
                      };
                    }
                    return next;
                  })
                );
                setMessage("已保存");
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "保存失败");
              }
            });
          }}
          onReorder={(orderedIds) => {
            startTransition(async () => {
              try {
                const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
                setRequirements((prev) =>
                  [...prev]
                    .map((r) =>
                      orderMap.has(r.id) ? { ...r, sort_order: orderMap.get(r.id)! } : r
                    )
                    .sort((a, b) => a.sort_order - b.sort_order)
                );
                await Promise.all(
                  orderedIds.map((id, i) =>
                    saveRequirementDetailAction({
                      requirementId: id,
                      projectSlug,
                      updates: { sort_order: i },
                    })
                  )
                );
                setMessage("顺序已更新");
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "排序失败");
              }
            });
          }}
          onTreeDrop={({ dragId, orderedIds, nextParentId }) => {
            startTransition(async () => {
              try {
                const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
                setRequirements((prev) =>
                  [...prev]
                    .map((r) => {
                      let next = r;
                      if (r.id === dragId) {
                        next = { ...next, parent_id: nextParentId };
                      }
                      if (orderMap.has(r.id)) {
                        next = { ...next, sort_order: orderMap.get(r.id)! };
                      }
                      return next;
                    })
                    .sort((a, b) => a.sort_order - b.sort_order)
                );
                await saveRequirementDetailAction({
                  requirementId: dragId,
                  projectSlug,
                  updates: { parent_id: nextParentId },
                });
                await Promise.all(
                  orderedIds.map((id, i) =>
                    saveRequirementDetailAction({
                      requirementId: id,
                      projectSlug,
                      updates: { sort_order: i },
                    })
                  )
                );
                setMessage("层级 / 顺序已更新");
                router.refresh();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "拖拽保存失败");
                router.refresh();
              }
            });
          }}
        />

        {drawerReq ? (
          <RequirementSidePeek
            key={drawerReq.id}
            requirement={drawerReq}
            attachments={drawerAttachments}
            pending={pending}
            activeIterations={activeIterations}
            members={members.filter((m) => m.is_active)}
            projectSlug={projectSlug}
            onClose={closeDrawer}
            onSave={(updates) => {
              startTransition(async () => {
                try {
                  await saveRequirementDetailAction({
                    requirementId: drawerReq.id,
                    projectSlug,
                    updates,
                  });
                  setRequirements((prev) =>
                    prev.map((r) =>
                      r.id === drawerReq.id ? ({ ...r, ...updates, updated_at: new Date().toISOString() } as Requirement) : r
                    )
                  );
                  setMessage("已保存");
                  router.refresh();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "保存失败");
                }
              });
            }}
            onPromote={(iterationId) => {
              startTransition(async () => {
                await promotePoolRequirementAction({
                  requirementId: drawerReq.id,
                  iterationId,
                  projectSlug,
                });
                setMessage("已加入迭代");
                router.refresh();
              });
            }}
            onDelete={() => {
              if (!confirm("删除该需求？")) return;
              startTransition(async () => {
                await deletePoolRequirementAction(drawerReq.id, projectSlug);
                closeDrawer();
                router.refresh();
              });
            }}
            onUpload={async (file) => {
              const form = new FormData();
              form.set("projectId", projectId);
              form.set("requirementId", drawerReq.id);
              form.set("title", file.name);
              form.set("file", file);
              const res = await fetch("/api/projects/attachments", { method: "POST", body: form });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? "上传失败");
              setAttachments((prev) => [data.attachment, ...prev]);
              router.refresh();
            }}
            onRemoveAttachment={async (id) => {
              const res = await fetch(`/api/projects/attachments?id=${id}`, { method: "DELETE" });
              if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? "删除失败");
              }
              setAttachments((prev) => prev.filter((a) => a.id !== id));
            }}
            onOpenLightbox={setLightbox}
            links={links}
            timelineEntities={[
              ...timelineEntities,
              ...requirements.map((r) => ({
                id: r.id,
                kind: "requirement" as const,
                title: r.title,
                at: r.submitted_at ?? r.created_at,
                note: r.next_step,
              })),
            ]}
            onForceClose={() => {
              if (!confirm("强制关闭该需求（标为已取消）？用于不做这个方向。")) return;
              startTransition(async () => {
                await forceCloseRequirementAction({
                  requirementId: drawerReq.id,
                  projectSlug,
                });
                setMessage("已强制关闭");
                router.refresh();
              });
            }}
            onAddChild={() => addRow(drawerReq.id)}
          />
        ) : null}
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-6"
          onClick={() => setLightbox(null)}
          role="dialog"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="预览"
            className="max-h-full max-w-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

function TagEditor({
  label,
  tags,
  onChange,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const t = draft.trim();
    if (!t) return;
    if (tags.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...tags, t]);
    setDraft("");
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== tag))}
            className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-100"
            title="点击移除"
          >
            {tag} ×
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder ?? "输入后回车添加"}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={addTag}
          className="shrink-0 rounded-lg border border-slate-200 px-3 text-xs text-slate-600"
        >
          添加
        </button>
      </div>
    </div>
  );
}

function RequirementSidePeek({
  requirement,
  attachments,
  pending,
  activeIterations,
  members,
  projectSlug,
  links,
  timelineEntities,
  onClose,
  onSave,
  onPromote,
  onDelete,
  onForceClose,
  onAddChild,
  onUpload,
  onRemoveAttachment,
  onOpenLightbox,
}: {
  requirement: Requirement;
  attachments: RequirementAttachment[];
  pending: boolean;
  activeIterations: Iteration[];
  members: ProjectMember[];
  projectSlug: string;
  links: RequirementLink[];
  timelineEntities: TimelineEntity[];
  onClose: () => void;
  onSave: (updates: Parameters<typeof saveRequirementDetailAction>[0]["updates"]) => void;
  onPromote: (iterationId: string) => void;
  onDelete: () => void;
  onForceClose: () => void;
  onAddChild: () => void;
  onUpload: (file: File) => Promise<void>;
  onRemoveAttachment: (id: string) => Promise<void>;
  onOpenLightbox: (url: string) => void;
}) {
  const [title, setTitle] = useState(requirement.title);
  const [reqType, setReqType] = useState<RequirementType>(requirement.type ?? "task");
  const [detailWork, setDetailWork] = useState(requirement.detail_work ?? "");
  const [acceptance, setAcceptance] = useState(requirement.acceptance_criteria ?? "");
  const [statusTags, setStatusTags] = useState(requirement.status_tags ?? ["待开始"]);
  const [assignees, setAssignees] = useState(requirement.assignees ?? []);
  const [priority, setPriority] = useState(requirement.priority ?? "P1");
  const [hours, setHours] = useState(
    requirement.product_estimate_hours != null ? String(requirement.product_estimate_hours) : ""
  );
  const [directHours, setDirectHours] = useState(
    requirement.direct_hours != null ? String(requirement.direct_hours) : ""
  );
  const [reqSource, setReqSource] = useState(requirement.req_source ?? "");
  const [reqSourceNote, setReqSourceNote] = useState(requirement.req_source_note ?? "");
  const [inspirationSource, setInspirationSource] = useState(
    requirement.inspiration_source ?? ""
  );
  const [nextStep, setNextStep] = useState(requirement.next_step ?? "");
  const [submittedAt, setSubmittedAt] = useState(requirement.submitted_at ?? "");
  const [dueDate, setDueDate] = useState(requirement.due_date ?? "");
  const [prdLink, setPrdLink] = useState(requirement.prd_link ?? "");
  const [prototypeLink, setPrototypeLink] = useState(requirement.prototype_link ?? "");
  const [iterationId, setIterationId] = useState(activeIterations[0]?.id ?? "");
  const [uploading, setUploading] = useState(false);
  const memberNames = members.map((m) => m.name);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleAssignee(name: string) {
    setAssignees((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  const fullHref = `/projects/${projectSlug}/requirements/${requirement.id}`;
  const done = requirementIsDone({ status_tags: statusTags, status: requirement.status });
  const relatedLinks = links.filter(
    (l) =>
      (l.source_type === "requirement" && l.source_id === requirement.id) ||
      (l.target_type === "requirement" && l.target_id === requirement.id)
  );

  return (
    <aside className="flex max-h-[70vh] flex-col border-t border-slate-100 bg-white lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Side Peek</span>
          {done ? <StudioBadge>完成</StudioBadge> : null}
          {requirement.force_closed ? <StudioBadge tone="warning">已取消</StudioBadge> : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddChild}
            className="rounded-md px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
          >
            + 子需求
          </button>
          <Link
            href={fullHref}
            className="rounded-md px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
          >
            全屏打开
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
          >
            关闭
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border-0 border-b border-transparent bg-transparent text-lg font-semibold text-slate-900 outline-none focus:border-indigo-200"
          placeholder="需求名称"
        />

        <label className="block text-xs text-slate-500">
          类型
          <select
            value={reqType}
            onChange={(e) => setReqType(e.target.value as RequirementType)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
          >
            <option value="epic">大型模块</option>
            <option value="feature">功能</option>
            <option value="task">任务</option>
          </select>
        </label>

        <TagEditor
          label="状态标签（输入文字添加，如：评审、完成）"
          tags={statusTags}
          onChange={setStatusTags}
          placeholder="例：评审 / 开发中 / 完成"
        />

        <div className="space-y-1.5">
          <span className="text-xs text-slate-500">需求指派（可多选）</span>
          {memberNames.length === 0 ? (
            <p className="text-xs text-slate-400">暂无成员，可在项目设置添加后勾选</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {memberNames.map((name) => {
                const on = assignees.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleAssignee(name)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs ring-1",
                      on
                        ? "bg-violet-50 text-violet-800 ring-violet-200"
                        : "bg-white text-slate-600 ring-slate-200"
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
          <TagEditor
            label="或直接输入指派人"
            tags={assignees.filter((a) => !memberNames.includes(a))}
            onChange={(extra) =>
              setAssignees([...assignees.filter((a) => memberNames.includes(a)), ...extra])
            }
            placeholder="姓名后回车"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-slate-500">优先级</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-2"
            >
              {["P0", "P1", "P2", "P3"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-slate-500">叶子预计工时</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-slate-500">直接工时（父节点附加）</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={directHours}
              onChange={(e) => setDirectHours(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-slate-500">需求来源</span>
            <select
              value={reqSource}
              onChange={(e) => setReqSource(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-2"
            >
              <option value="">空白</option>
              {REQ_SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p className="text-[11px] leading-snug text-slate-400">
              谁提出 / 归属哪类干系人（客户、用户、产品经理…）
            </p>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-slate-500">来源备注</span>
            <input
              value={reqSourceNote}
              onChange={(e) => setReqSourceNote(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="col-span-2 block space-y-1 text-sm">
            <span className="text-xs text-slate-500">灵感来源</span>
            <input
              value={inspirationSource}
              onChange={(e) => setInspirationSource(e.target.value)}
              placeholder="例：ChatGPT 会话、刷到 demo、层级整理"
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            <p className="text-[11px] leading-snug text-slate-400">
              念头从哪件事触发；与上方「需求来源」不同——那边填干系人，这里填场景/素材
            </p>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-slate-500">提出时间</span>
            <input
              type="date"
              value={submittedAt}
              onChange={(e) => setSubmittedAt(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-slate-500">结束时间</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-slate-500">完成时间</span>
            <input
              type="text"
              readOnly
              value={
                requirement.completed_at
                  ? requirement.completed_at.replace("T", " ").slice(0, 16)
                  : done
                    ? "保存后写入"
                    : "—"
              }
              className="w-full rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-slate-500"
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-xs text-slate-500">下一步</span>
          <input
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-xs text-slate-500">需求内容</span>
          <textarea
            value={detailWork}
            onChange={(e) => setDetailWork(e.target.value)}
            rows={7}
            placeholder="作为[角色]，我希望[功能]，以便[价值]。"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-xs text-slate-500">验收标准</span>
          <textarea
            value={acceptance}
            onChange={(e) => setAcceptance(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={prdLink}
            onChange={(e) => setPrdLink(e.target.value)}
            placeholder="PRD 链接"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={prototypeLink}
            onChange={(e) => setPrototypeLink(e.target.value)}
            placeholder="原型链接"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">附件</span>
            <label className="cursor-pointer text-xs text-indigo-600 hover:underline">
              {uploading ? "上传中…" : "+ 添加文件"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setUploading(true);
                  try {
                    await onUpload(file);
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
          </div>
          {attachments.length === 0 ? (
            <p className="text-xs text-slate-400">暂无附件</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {attachments.map((a) => (
                <div key={a.id} className="group relative overflow-hidden rounded-lg border">
                  {isImage(a.mime_type, a.url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.url}
                      alt={a.title}
                      className="h-20 w-full cursor-zoom-in object-cover"
                      onClick={() => onOpenLightbox(a.url)}
                    />
                  ) : (
                    <a
                      href={a.url}
                      className="block p-2 text-[10px] text-indigo-600"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {a.title}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(a.id)}
                    className="absolute right-0.5 top-0.5 hidden rounded bg-black/60 px-1 text-[10px] text-white group-hover:block"
                  >
                    删
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2 border-t border-slate-100 pt-3">
          <h3 className="text-xs font-medium text-slate-500">Memory Timeline</h3>
          <RequirementMemoryTimeline
            requirementId={requirement.id}
            links={links}
            entities={timelineEntities}
          />
          {relatedLinks.length ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              {relatedLinks.map((l) => (
                <li key={l.id}>
                  {l.relation_type}: {l.source_type}/{l.source_id.slice(0, 8)} →{" "}
                  {l.target_type}/{l.target_id.slice(0, 8)}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {activeIterations.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-500">计划（第几期）</span>
            <select
              value={iterationId}
              onChange={(e) => setIterationId(e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm"
            >
              {activeIterations.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending || !iterationId}
              onClick={() => onPromote(iterationId)}
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 disabled:opacity-50"
            >
              加入该计划
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
        <div className="flex gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="text-sm text-red-600 hover:underline disabled:opacity-50"
          >
            删除
          </button>
          {!requirement.force_closed ? (
            <button
              type="button"
              disabled={pending}
              onClick={onForceClose}
              className="text-sm text-amber-700 hover:underline disabled:opacity-50"
            >
              强制关闭
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
          >
            返回
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              onSave({
                title: title.trim() || requirement.title,
                type: reqType,
                detail_work: detailWork.trim() || null,
                acceptance_criteria: acceptance.trim() || null,
                status_tags: statusTags,
                assignees,
                priority: priority.trim() || null,
                product_estimate_hours: hours.trim() ? Number(hours) : null,
                direct_hours: directHours.trim() ? Number(directHours) : null,
                req_source: reqSource.trim() || null,
                req_source_note: reqSourceNote.trim() || null,
                inspiration_source: inspirationSource.trim() || null,
                next_step: nextStep.trim() || null,
                submitted_at: submittedAt.trim() || null,
                due_date: dueDate.trim() || null,
                prd_link: prdLink.trim() || null,
                prototype_link: prototypeLink.trim() || null,
              })
            }
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>
    </aside>
  );
}
