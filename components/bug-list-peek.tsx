"use client";

import { useEffect, useState } from "react";
import { fetchBugDetail } from "@/lib/actions";
import {
  BugDetailEditor,
  type BugFormOption,
  type MemberOption,
} from "@/components/bug-side-form";
import type { CrossLinkOption } from "@/components/cross-link-section";
import type {
  Bug,
  BugAttachment,
  BugComment,
  BugTestPlan,
  Iteration,
} from "@/lib/types";

type DetailPayload = {
  bug: Bug;
  projectName: string;
  requirementTitle: string | null;
  comments: BugComment[];
  attachments: BugAttachment[];
};

/**
 * 列表分栏右栏：加载完整 Bug 详情（前置/步骤/预期/实际+附图+属性），
 * 约定：左列表右详情；↗ 全页仍走 /bugs/[id]。
 */
export function BugListPeekPanel({
  bugId,
  fallbackBug,
  projectId,
  projectSlug,
  projectName,
  members,
  requirements,
  featureModules = [],
  testPlans = [],
  iterations = [],
  learningOptions = [],
  competitorOptions = [],
  onClose,
}: {
  bugId: string;
  fallbackBug: Bug;
  projectId: string;
  projectSlug: string;
  projectName: string;
  members: MemberOption[];
  requirements: BugFormOption[];
  featureModules?: string[];
  testPlans?: BugTestPlan[];
  iterations?: Iteration[];
  learningOptions?: CrossLinkOption[];
  competitorOptions?: CrossLinkOption[];
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    void (async () => {
      try {
        const d = await fetchBugDetail(bugId);
        if (cancelled) return;
        if (!d?.bug) {
          setError("加载失败");
          setLoading(false);
          return;
        }
        setDetail({
          bug: d.bug,
          projectName: d.project?.name ?? projectName,
          requirementTitle: d.requirement?.title ?? null,
          comments: d.comments ?? [],
          attachments: d.attachments ?? [],
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bugId, projectName]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        加载详情…
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm">
        <p className="text-rose-600">{error}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-200 px-2 py-1 text-xs"
        >
          关闭
        </button>
      </div>
    );
  }

  const bug = detail?.bug ?? fallbackBug;

  return (
    <BugDetailEditor
      key={bug.id}
      variant="peek"
      onClose={onClose}
      bug={bug}
      projectId={projectId}
      projectSlug={projectSlug}
      projectName={detail?.projectName ?? projectName}
      requirementTitle={detail?.requirementTitle}
      members={members}
      requirements={requirements}
      featureModules={featureModules}
      testPlans={testPlans}
      iterations={iterations}
      comments={detail?.comments ?? []}
      attachments={detail?.attachments ?? []}
      learningOptions={learningOptions}
      competitorOptions={competitorOptions}
    />
  );
}
