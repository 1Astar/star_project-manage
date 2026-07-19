"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  ProjectPriority,
  ProjectStatus,
  StudioCustomFieldValue,
  StudioProjectColumnDef,
} from "@/lib/studio/types";
import { PROJECT_STATUS_LABELS } from "@/lib/studio/types";

const STATUS_OPTIONS: ProjectStatus[] = ["active", "mainline", "demo", "parking"];
const PRIORITY_OPTIONS: ProjectPriority[] = ["P0", "P1", "P2", "P3"];

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800";
const labelClass = "block text-xs text-slate-500";

export type SourceIdeaOption = {
  id: string;
  title: string;
  oneLineIdea: string;
  whyItMatters: string;
  priority: ProjectPriority;
  suggestedNextStep: string;
};

export function CreateProjectButton({
  sourceIdeas = [],
  columnDefs = [],
}: {
  sourceIdeas?: SourceIdeaOption[];
  columnDefs?: StudioProjectColumnDef[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceIdeaId, setSourceIdeaId] = useState("");

  const [title, setTitle] = useState("");
  const [positioning, setPositioning] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [portfolioValue, setPortfolioValue] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [priority, setPriority] = useState<ProjectPriority>("P2");
  const [currentStage, setCurrentStage] = useState("起步");
  const [nextAction, setNextAction] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [vercelUrl, setVercelUrl] = useState("");
  const [relatedPageUrl, setRelatedPageUrl] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("");
  const [codePath, setCodePath] = useState("");
  const [localRunGuide, setLocalRunGuide] = useState("");
  const [customFields, setCustomFields] = useState<Record<string, StudioCustomFieldValue>>({});

  function reset() {
    setSourceIdeaId("");
    setTitle("");
    setPositioning("");
    setTargetUser("");
    setPortfolioValue("");
    setStatus("active");
    setPriority("P2");
    setCurrentStage("起步");
    setNextAction("");
    setDemoUrl("");
    setVercelUrl("");
    setRelatedPageUrl("");
    setGithubRepo("");
    setGithubBranch("");
    setCodePath("");
    setLocalRunGuide("");
    setCustomFields({});
    setMoreOpen(false);
    setError(null);
  }

  function applySourceIdea(id: string) {
    setSourceIdeaId(id);
    if (!id) return;
    const idea = sourceIdeas.find((i) => i.id === id);
    if (!idea) return;
    setTitle(idea.title);
    setPositioning(idea.oneLineIdea || "");
    setPortfolioValue(idea.whyItMatters || "");
    setPriority(idea.priority);
    setNextAction(idea.suggestedNextStep || "");
    setCurrentStage("起步");
  }

  function projectPayload() {
    const fields: Record<string, StudioCustomFieldValue> = {};
    for (const def of columnDefs) {
      const raw = customFields[def.key];
      if (def.columnType === "checkbox") {
        fields[def.key] = Boolean(raw);
        continue;
      }
      if (raw === undefined || raw === null || raw === "") continue;
      if (def.columnType === "number") {
        const n = Number(raw);
        if (!Number.isNaN(n)) fields[def.key] = n;
        continue;
      }
      fields[def.key] = raw;
    }
    return {
      title: title.trim(),
      positioning: positioning.trim() || undefined,
      targetUser: targetUser.trim() || undefined,
      portfolioValue: portfolioValue.trim() || undefined,
      status,
      priority,
      currentStage: currentStage.trim() || "起步",
      nextAction: nextAction.trim() || undefined,
      demoUrl: demoUrl.trim() || null,
      vercelUrl: vercelUrl.trim() || null,
      relatedPageUrl: relatedPageUrl.trim() || null,
      githubRepo: githubRepo.trim() || null,
      githubBranch: githubBranch.trim() || undefined,
      codePath: codePath.trim() || null,
      localRunGuide: localRunGuide.trim() || null,
      customFields: Object.keys(fields).length ? fields : undefined,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      setError("项目名必填");
      return;
    }
    if (githubRepo.trim() && !githubBranch.trim()) {
      setError("填写仓库时必须指定分支");
      setMoreOpen(true);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const payload = projectPayload();
      let projectId: string | undefined;

      if (sourceIdeaId) {
        const res = await fetch(`/api/studio/ideas/${sourceIdeaId}/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: payload }),
        });
        const data = (await res.json()) as { error?: string; project?: { id: string } };
        if (!res.ok || !data.project?.id) {
          setError(data.error ?? "从灵感创建失败");
          return;
        }
        projectId = data.project.id;
      } else {
        const res = await fetch("/api/studio/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string; project?: { id: string } };
        if (!res.ok || !data.project?.id) {
          setError(data.error ?? "创建失败");
          return;
        }
        projectId = data.project.id;
      }

      reset();
      setOpen(false);
      router.push(`/projects/${projectId}`);
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setError(null);
        }}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
      >
        ＋ 新建项目
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[420px] max-h-[min(80vh,640px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <form onSubmit={onSubmit} className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-700">新建 Studio 项目</p>

            {sourceIdeas.length > 0 ? (
              <label className={labelClass}>
                来源灵感
                <select
                  value={sourceIdeaId}
                  onChange={(e) => applySourceIdea(e.target.value)}
                  className={inputClass}
                >
                  <option value="">无（空白新建）</option>
                  {sourceIdeas.map((idea) => (
                    <option key={idea.id} value={idea.id}>
                      {idea.title}
                    </option>
                  ))}
                </select>
                {sourceIdeaId ? (
                  <span className="mt-1 block text-[11px] text-indigo-600">
                    将自动关联灵感、写入定位与初始演进
                  </span>
                ) : null}
              </label>
            ) : null}

            <label className={labelClass}>
              项目名 *
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：竞品分析工作台"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              一句话定位
              <input
                value={positioning}
                onChange={(e) => setPositioning(e.target.value)}
                placeholder="可选"
                className={inputClass}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className={labelClass}>
                状态
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className={inputClass}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                优先级
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ProjectPriority)}
                  className={inputClass}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className={labelClass}>
              当前阶段
              <input
                value={currentStage}
                onChange={(e) => setCurrentStage(e.target.value)}
                placeholder="例：起步"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              下一步
              <input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="可选"
                className={inputClass}
              />
            </label>

            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="w-full rounded-lg border border-dashed border-slate-200 px-2.5 py-1.5 text-left text-xs text-slate-500 hover:border-slate-300 hover:bg-slate-50"
            >
              {moreOpen
                ? "▾ 收起更多字段"
                : `▸ 更多字段（用户 / 链接 / 代码${columnDefs.length ? " / 自定义" : ""}）`}
            </button>

            {moreOpen ? (
              <div className="space-y-2.5 border-t border-slate-100 pt-2.5">
                <label className={labelClass}>
                  目标用户
                  <input
                    value={targetUser}
                    onChange={(e) => setTargetUser(e.target.value)}
                    placeholder="可选"
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  作品集价值
                  <input
                    value={portfolioValue}
                    onChange={(e) => setPortfolioValue(e.target.value)}
                    placeholder="可选"
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  展示链接
                  <input
                    value={demoUrl}
                    onChange={(e) => setDemoUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Vercel URL
                  <input
                    value={vercelUrl}
                    onChange={(e) => setVercelUrl(e.target.value)}
                    placeholder="可选"
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  相关页 URL
                  <input
                    value={relatedPageUrl}
                    onChange={(e) => setRelatedPageUrl(e.target.value)}
                    placeholder="可选"
                    className={inputClass}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={labelClass}>
                    GitHub 仓库
                    <input
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                      placeholder="owner/repo"
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    分支
                    <input
                      value={githubBranch}
                      onChange={(e) => setGithubBranch(e.target.value)}
                      placeholder={githubRepo.trim() ? "填仓库时必填" : "可选"}
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className={labelClass}>
                  代码目录
                  <input
                    value={codePath}
                    onChange={(e) => setCodePath(e.target.value)}
                    placeholder="monorepo 相对路径，整仓留空"
                    className={`${inputClass} font-mono text-xs`}
                  />
                </label>
                <label className={labelClass}>
                  本地启动
                  <textarea
                    value={localRunGuide}
                    onChange={(e) => setLocalRunGuide(e.target.value)}
                    rows={2}
                    placeholder="可选"
                    className={`${inputClass} font-mono text-xs`}
                  />
                </label>

                {columnDefs.length > 0 ? (
                  <div className="space-y-2.5 border-t border-dashed border-slate-100 pt-2.5">
                    <p className="text-[11px] font-medium text-slate-500">自定义字段</p>
                    {columnDefs.map((def) => (
                      <label key={def.id} className={labelClass}>
                        {def.label}
                        {def.columnType === "checkbox" ? (
                          <input
                            type="checkbox"
                            checked={Boolean(customFields[def.key])}
                            onChange={(e) =>
                              setCustomFields((prev) => ({
                                ...prev,
                                [def.key]: e.target.checked,
                              }))
                            }
                            className="mt-1 block"
                          />
                        ) : def.columnType === "select" ? (
                          <select
                            value={String(customFields[def.key] ?? "")}
                            onChange={(e) =>
                              setCustomFields((prev) => ({
                                ...prev,
                                [def.key]: e.target.value || null,
                              }))
                            }
                            className={inputClass}
                          >
                            <option value="">可选</option>
                            {def.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={
                              def.columnType === "number"
                                ? "number"
                                : def.columnType === "date"
                                  ? "date"
                                  : "text"
                            }
                            value={String(customFields[def.key] ?? "")}
                            onChange={(e) =>
                              setCustomFields((prev) => ({
                                ...prev,
                                [def.key]: e.target.value,
                              }))
                            }
                            placeholder="可选"
                            className={inputClass}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={pending || !title.trim()}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {pending
                  ? "创建中…"
                  : sourceIdeaId
                    ? "从灵感创建"
                    : "创建"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
