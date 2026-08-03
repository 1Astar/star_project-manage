"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createInterviewAction,
  listInterviewsForRequirementAction,
  listProjectInterviewsAction,
  linkInterviewRequirementAction,
  unlinkInterviewRequirementAction,
} from "@/lib/actions";
import type { ProjectInterview } from "@/lib/types";

export function RequirementInterviewsPanel({
  projectId,
  projectSlug,
  requirementId,
}: {
  projectId: string;
  projectSlug: string;
  requirementId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [related, setRelated] = useState<ProjectInterview[]>([]);
  const [all, setAll] = useState<ProjectInterview[]>([]);
  const [showLink, setShowLink] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    const [linked, projectAll] = await Promise.all([
      listInterviewsForRequirementAction(requirementId),
      listProjectInterviewsAction(projectId),
    ]);
    setRelated(linked);
    setAll(projectAll);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [linked, projectAll] = await Promise.all([
          listInterviewsForRequirementAction(requirementId),
          listProjectInterviewsAction(projectId),
        ]);
        if (!cancelled) {
          setRelated(linked);
          setAll(projectAll);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载访谈失败");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, requirementId]);

  const linkable = all.filter((iv) => !related.some((r) => r.id === iv.id));

  function createLinked() {
    const title = newTitle.trim() || "未命名访谈";
    startTransition(async () => {
      try {
        await createInterviewAction({
          projectId,
          projectSlug,
          title,
          requirementId,
        });
        setNewTitle("");
        await reload();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "创建失败");
      }
    });
  }

  function linkOne(interviewId: string) {
    startTransition(async () => {
      try {
        await linkInterviewRequirementAction({
          projectId,
          interviewId,
          requirementId,
          projectSlug,
        });
        setShowLink(false);
        await reload();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "关联失败");
      }
    });
  }

  function unlinkOne(interviewId: string) {
    startTransition(async () => {
      try {
        await unlinkInterviewRequirementAction({
          interviewId,
          requirementId,
          projectSlug,
        });
        await reload();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "取消关联失败");
      }
    });
  }

  return (
    <section className="space-y-2 border-t border-slate-100 pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">相关访谈</span>
        <Link
          href={`/projects/${projectSlug}/interviews`}
          className="text-[11px] text-indigo-600 hover:underline"
        >
          打开访谈库
        </Link>
      </div>

      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}

      {related.length === 0 ? (
        <p className="text-xs text-slate-400">尚未关联访谈</p>
      ) : (
        <ul className="space-y-1.5">
          {related.map((iv) => (
            <li
              key={iv.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5"
            >
              <div className="min-w-0">
                <Link
                  href={`/projects/${projectSlug}/interviews`}
                  className="block truncate text-sm font-medium text-slate-800 hover:text-indigo-700"
                >
                  {iv.title}
                </Link>
                <p className="text-[11px] text-slate-500">
                  假设 {iv.hypotheses.length}
                  {iv.product_judgment ? " · 已有判断" : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => unlinkOne(iv.id)}
                className="shrink-0 text-[11px] text-slate-400 hover:text-rose-600"
              >
                取消
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="新建并关联…"
          className="min-w-[140px] flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs"
        />
        <button
          type="button"
          disabled={pending}
          onClick={createLinked}
          className="rounded-md bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          创建
        </button>
        <button
          type="button"
          onClick={() => setShowLink((v) => !v)}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
        >
          {showLink ? "收起" : "关联已有"}
        </button>
      </div>

      {showLink ? (
        linkable.length === 0 ? (
          <p className="text-[11px] text-slate-400">没有可关联的访谈</p>
        ) : (
          <ul className="max-h-28 space-y-1 overflow-auto rounded-md border border-slate-100 p-1">
            {linkable.map((iv) => (
              <li key={iv.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => linkOne(iv.id)}
                  className="w-full rounded px-2 py-1 text-left text-xs hover:bg-indigo-50"
                >
                  {iv.title}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
