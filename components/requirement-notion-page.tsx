"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRequirementDetailAction } from "@/lib/actions";
import type { Requirement, TaskStatus } from "@/lib/types";
import { TASK_STATUS_LABELS } from "@/lib/types";

const STATUS_OPTIONS: TaskStatus[] = [
  "pending",
  "in_progress",
  "testing",
  "acceptance",
  "done",
  "blocked",
];

type Props = {
  projectSlug: string;
  requirement: Requirement;
  backHref: string;
  /** 右侧栏追加：角色任务、测试核对等 */
  sidebar?: ReactNode;
};

export function RequirementNotionPage({
  projectSlug,
  requirement,
  backHref,
  sidebar,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(requirement.title);
  const [detailWork, setDetailWork] = useState(requirement.detail_work ?? "");
  const [acceptance, setAcceptance] = useState(requirement.acceptance_criteria ?? "");
  const [scenario, setScenario] = useState(requirement.scenario ?? "");
  const [optimization, setOptimization] = useState(requirement.optimization_notes ?? "");
  const [issues, setIssues] = useState(requirement.known_issues ?? "");
  const [prdLink, setPrdLink] = useState(requirement.prd_link ?? "");
  const [prototypeLink, setPrototypeLink] = useState(requirement.prototype_link ?? "");
  const [relatedLinks, setRelatedLinks] = useState(
    String(requirement.custom_fields?.related_links ?? "")
  );
  const [status, setStatus] = useState(requirement.status);
  const [priority, setPriority] = useState(requirement.priority ?? "");
  const [message, setMessage] = useState<string | null>(null);

  function save(updates: Parameters<typeof saveRequirementDetailAction>[0]["updates"]) {
    startTransition(async () => {
      try {
        setMessage(null);
        await saveRequirementDetailAction({
          requirementId: requirement.id,
          projectSlug,
          updates,
        });
        setMessage("已保存");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      }
    });
  }

  function saveAll() {
    save({
      title: title.trim() || requirement.title,
      detail_work: detailWork.trim() || null,
      acceptance_criteria: acceptance.trim() || null,
      scenario: scenario.trim() || null,
      optimization_notes: optimization.trim() || null,
      known_issues: issues.trim() || null,
      status,
      priority: priority.trim() || null,
      prd_link: prdLink.trim() || null,
      prototype_link: prototypeLink.trim() || null,
      custom_fields: {
        ...requirement.custom_fields,
        related_links: relatedLinks.trim() || null,
      },
    });
  }

  const relatedList = relatedLinks
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href={backHref} className="text-sm text-indigo-600 hover:underline">
          ← 返回
        </a>
        <div className="flex items-center gap-2">
          {message ? <span className="text-xs text-slate-500">{message}</span> : null}
          <button
            type="button"
            disabled={pending}
            onClick={saveAll}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)]">
        <div className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title.trim() !== requirement.title) {
                save({ title: title.trim() });
              }
            }}
            className="w-full border-0 bg-transparent text-xl font-bold text-slate-900 outline-none placeholder:text-slate-300"
            placeholder="无标题需求"
          />

          <section className="space-y-1.5 border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold text-slate-500">需求描述</h3>
            <textarea
              value={detailWork}
              onChange={(e) => setDetailWork(e.target.value)}
              rows={6}
              placeholder="背景、方案、说明…"
              className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
            />
          </section>

          <section className="space-y-1.5 border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold text-slate-500">验收标准</h3>
            <textarea
              value={acceptance}
              onChange={(e) => setAcceptance(e.target.value)}
              rows={3}
              placeholder="可验收的完成标准"
              className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-300 focus:bg-white"
            />
          </section>

          <section className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-slate-500">场景</h3>
              <textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-300"
              />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-slate-500">优化方向</h3>
              <textarea
                value={optimization}
                onChange={(e) => setOptimization(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-300"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <h3 className="text-xs font-semibold text-slate-500">已知问题</h3>
              <textarea
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-300"
              />
            </div>
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-3 lg:self-start">
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="mb-2 text-xs font-semibold text-slate-500">基本信息</h3>
            <div className="space-y-2 text-sm">
              <label className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-slate-500">状态</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-800"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-slate-500">优先级</span>
                <input
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  placeholder="P0"
                  className="w-20 rounded-md border border-slate-200 px-2 py-1 text-right text-slate-800"
                />
              </label>
              {requirement.in_pool ? (
                <div className="text-xs text-amber-700">需求池</div>
              ) : null}
              <label className="block space-y-1">
                <span className="text-slate-500">PRD</span>
                <input
                  value={prdLink}
                  onChange={(e) => setPrdLink(e.target.value)}
                  placeholder="https://"
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-300"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-500">原型</span>
                <input
                  value={prototypeLink}
                  onChange={(e) => setPrototypeLink(e.target.value)}
                  placeholder="https://"
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-300"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-500">其他链接</span>
                <textarea
                  value={relatedLinks}
                  onChange={(e) => setRelatedLinks(e.target.value)}
                  rows={2}
                  placeholder="每行一个"
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-300"
                />
              </label>
              {relatedList.length > 0 || prdLink || prototypeLink ? (
                <ul className="space-y-0.5 border-t border-slate-100 pt-2 text-xs">
                  {prdLink ? (
                    <li>
                      <a
                        href={prdLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        PRD →
                      </a>
                    </li>
                  ) : null}
                  {prototypeLink ? (
                    <li>
                      <a
                        href={prototypeLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        原型 →
                      </a>
                    </li>
                  ) : null}
                  {relatedList.map((url) => (
                    <li key={url} className="truncate">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>

          {sidebar}
        </aside>
      </div>
    </div>
  );
}
