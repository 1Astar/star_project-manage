"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CrossLinkSection,
  type CrossLinkOption,
} from "@/components/cross-link-section";
import {
  EntitySidePeek,
  type EntityPeekPayload,
} from "@/components/entity-side-peek";
import {
  linkLearningNoteRequirementAction,
  unlinkLearningNoteRequirementAction,
  updateBugAction,
  updateCompetitorEntryAction,
  updateLearningNoteAction,
} from "@/lib/actions";

type Props = {
  projectSlug: string;
  projectRouteId: string;
  requirementId: string;
  linkedLearningIds: string[];
  linkedCompetitorIds: string[];
  linkedBugIds: string[];
  learningOptions: CrossLinkOption[];
  competitorOptions: CrossLinkOption[];
  bugOptions: CrossLinkOption[];
  /** 竞品 id → 当前已挂需求 id（用于增删后写回整表） */
  competitorLinkedReqIds: Record<string, string[]>;
};

/**
 * 需求明细：反向维护学习 / 竞品 / Bug 交叉关联（数据挂在对方实体上）。
 */
export function RequirementCrossLinks({
  projectSlug,
  projectRouteId,
  requirementId,
  linkedLearningIds: initialLearning,
  linkedCompetitorIds: initialCompetitor,
  linkedBugIds: initialBug,
  learningOptions,
  competitorOptions,
  bugOptions,
  competitorLinkedReqIds: initialCompReqMap,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [peekPending, setPeekPending] = useState(false);
  const [peek, setPeek] = useState<EntityPeekPayload | null>(null);
  const [linkedLearningIds, setLinkedLearningIds] = useState(initialLearning);
  const [linkedCompetitorIds, setLinkedCompetitorIds] =
    useState(initialCompetitor);
  const [linkedBugIds, setLinkedBugIds] = useState(initialBug);
  const [compReqMap, setCompReqMap] = useState(initialCompReqMap);
  const [error, setError] = useState<string | null>(null);

  const learningById = useMemo(
    () => new Map(learningOptions.map((o) => [o.id, o])),
    [learningOptions]
  );

  function refresh() {
    router.refresh();
  }

  function openPeek(opt: CrossLinkOption) {
    if (!opt.kind) return;
    setPeek({
      kind: opt.kind,
      id: opt.id,
      title: opt.title,
      href: opt.href,
      badge: opt.badge,
      fields: (opt.fields ?? [])
        .filter((f): f is typeof f & { key: string } => Boolean(f.key))
        .map((f) => ({
          key: f.key,
          label: f.label,
          value: f.value,
          multiline: f.multiline,
        })),
    });
  }

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        setError(null);
        await fn();
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <h3 className="mb-1 text-xs font-semibold text-slate-500">交叉关联</h3>
      <p className="mb-2 text-[10px] text-slate-400">
        与学习 / 竞品 / Bug 互相引用；点标题可开侧栏
      </p>
      {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}

      <CrossLinkSection
        title="关联学习"
        linkedIds={linkedLearningIds}
        options={learningOptions}
        pending={pending}
        pickPlaceholder="选择学习笔记…"
        onLink={(id) =>
          run(async () => {
            await linkLearningNoteRequirementAction({
              noteId: id,
              projectSlug,
              requirementId,
            });
            setLinkedLearningIds((prev) =>
              prev.includes(id) ? prev : [...prev, id]
            );
          })
        }
        onUnlink={(id) =>
          run(async () => {
            await unlinkLearningNoteRequirementAction({
              noteId: id,
              projectSlug,
              requirementId,
            });
            setLinkedLearningIds((prev) => prev.filter((x) => x !== id));
          })
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
          run(async () => {
            const current = compReqMap[id] ?? [];
            const next = Array.from(new Set([...current, requirementId]));
            await updateCompetitorEntryAction({
              entryId: id,
              projectSlug,
              linkedRequirementIds: next,
            });
            setCompReqMap((prev) => ({ ...prev, [id]: next }));
            setLinkedCompetitorIds((prev) =>
              prev.includes(id) ? prev : [...prev, id]
            );
          })
        }
        onUnlink={(id) =>
          run(async () => {
            const current = compReqMap[id] ?? [];
            const next = current.filter((x) => x !== requirementId);
            await updateCompetitorEntryAction({
              entryId: id,
              projectSlug,
              linkedRequirementIds: next,
            });
            setCompReqMap((prev) => ({ ...prev, [id]: next }));
            setLinkedCompetitorIds((prev) => prev.filter((x) => x !== id));
          })
        }
        onOpen={openPeek}
      />

      <CrossLinkSection
        title="关联 Bug"
        linkedIds={linkedBugIds}
        options={bugOptions}
        pending={pending}
        pickPlaceholder="选择 Bug…"
        onLink={(id) =>
          run(async () => {
            await updateBugAction({
              bugId: id,
              projectSlug,
              updates: { requirementId },
            });
            setLinkedBugIds((prev) =>
              prev.includes(id) ? prev : [...prev, id]
            );
          })
        }
        onUnlink={(id) =>
          run(async () => {
            await updateBugAction({
              bugId: id,
              projectSlug,
              updates: { requirementId: null },
            });
            setLinkedBugIds((prev) => prev.filter((x) => x !== id));
          })
        }
        onOpen={openPeek}
      />

      {peek ? (
        <EntitySidePeek
          item={peek}
          pending={peekPending}
          onClose={() => setPeek(null)}
          onSave={
            peek.kind === "learning" ||
            peek.kind === "competitor" ||
            peek.kind === "bug"
              ? async (patch) => {
                  setPeekPending(true);
                  try {
                    if (peek.kind === "learning") {
                      await updateLearningNoteAction({
                        noteId: peek.id,
                        projectSlug,
                        title: patch.title,
                        whyText: patch.fields.why_text,
                        principle: patch.fields.principle,
                      });
                    } else if (peek.kind === "competitor") {
                      await updateCompetitorEntryAction({
                        entryId: peek.id,
                        projectSlug,
                        title: patch.title,
                        summary: patch.fields.summary,
                      });
                    } else {
                      await updateBugAction({
                        bugId: peek.id,
                        projectSlug,
                        updates: {
                          title: patch.title,
                          description: patch.fields.description || null,
                        },
                      });
                    }
                    setPeek(null);
                    refresh();
                  } finally {
                    setPeekPending(false);
                  }
                }
              : undefined
          }
        />
      ) : null}

      <p className="mt-2 text-[10px] text-slate-400">
        也可从{" "}
        <a
          href={`/projects/${projectRouteId}/bugs?new=1&req=${requirementId}`}
          className="text-indigo-600 hover:underline"
        >
          提 Bug
        </a>{" "}
        直接挂本需求。
        {learningById.size === 0 ? " 学习池暂无条目时可先去学习池新建。" : ""}
      </p>
    </section>
  );
}
