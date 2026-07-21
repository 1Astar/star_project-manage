import { normalizeCapturePayload, type IdeaCapturePayload } from "@/lib/studio/idea-capture";
import { getAllIdeas, getAllProjects } from "@/lib/studio/data";
import { createStudioIdea } from "@/lib/studio/mutations";
import type { IdeaPriority } from "@/lib/studio/types";
import {
  CaptureDuplicateError,
  findDuplicateCandidates,
  suggestParentIdea,
} from "@/lib/studio/capture-relation";
import {
  appendPendingModuleMarker,
  needsModuleFill,
} from "@/lib/studio/inbound-rules";
import { resolveModuleForImport } from "@/lib/studio/infer-modules";

const PRIORITIES = new Set<IdeaPriority>(["P0", "P1", "P2", "P3"]);

export type CaptureIdeaResult = {
  ideaId: string;
  title: string;
  relatedIdeaId: string | null;
  parentAutoLinked: boolean;
  parentLinkReason: string | null;
  parentAlternatives: Array<{ id: string; title: string; score: number; reason: string }>;
  duplicateSkipped: boolean;
  /** 已关联项目但缺板块 → 待补齐 */
  pendingModuleFill: boolean;
};

export async function captureIdea(payload: IdeaCapturePayload): Promise<CaptureIdeaResult> {
  const fields = normalizeCapturePayload(payload);
  const force = Boolean(payload.force);
  const skipParentAuto = Boolean(payload.skipParentAuto);

  const existing = await getAllIdeas();
  const relatedProject = fields.relatedProjectId
    ? (await getAllProjects()).find((p) => p.id === fields.relatedProjectId)
    : undefined;

  if (!force) {
    const duplicates = findDuplicateCandidates(existing, fields.title, {
      projectId: fields.relatedProjectId,
      threshold: 0.85,
      limit: 5,
    });
    if (duplicates.length > 0) {
      throw new CaptureDuplicateError(
        `疑似重复灵感（最高相似 ${duplicates[0].score}）：${duplicates[0].title}（${duplicates[0].id}）。请改用 update_idea，或传 force:true 强制新建。`,
        duplicates
      );
    }
  }

  let relatedIdeaId = fields.relatedIdeaId ?? null;
  let parentAutoLinked = false;
  let parentLinkReason: string | null = null;
  let parentAlternatives: CaptureIdeaResult["parentAlternatives"] = [];

  if (!relatedIdeaId && !skipParentAuto) {
    const suggestion = suggestParentIdea(existing, {
      title: fields.title,
      projectId: fields.relatedProjectId,
      type: fields.type,
    });
    parentAlternatives = suggestion.alternatives.map((c) => ({
      id: c.id,
      title: c.title,
      score: c.score,
      reason: c.reason,
    }));
    if (suggestion.parent) {
      relatedIdeaId = suggestion.parent.id;
      parentAutoLinked = true;
      parentLinkReason = `${suggestion.parent.reason}（${suggestion.parent.title} · score ${suggestion.parent.score}）`;
    }
  }

  const moduleResolved = resolveModuleForImport(
    fields.relatedModule,
    [fields.title, fields.summary, fields.rawThought, fields.whyItMatters]
      .filter(Boolean)
      .join("\n"),
    fields.relatedProjectId,
    relatedProject
      ? {
          featureModules: relatedProject.featureModules,
          githubRepo: relatedProject.githubRepo,
        }
      : undefined
  );
  const pendingModuleFill = needsModuleFill({
    relatedProjectId: fields.relatedProjectId,
    module: moduleResolved.module,
  });
  let decisionNotes = fields.decisionNotes ?? "";
  if (pendingModuleFill) {
    decisionNotes = appendPendingModuleMarker(decisionNotes);
  } else if (moduleResolved.inferred && !decisionNotes.includes("关键词推断")) {
    decisionNotes = decisionNotes
      ? `${decisionNotes}\n板块由关键词推断为「${moduleResolved.module}」`
      : `板块由关键词推断为「${moduleResolved.module}」`;
  }

  const idea = await createStudioIdea({
    title: fields.title,
    rawInput: fields.rawThought,
    oneLineIdea: fields.summary,
    whyItMatters: fields.whyItMatters,
    aiSupplement: fields.aiSupplement,
    chatTopic: fields.chatTopic,
    triggerSource: fields.source,
    sourceChat: fields.sourceChat,
    sourceMethod: fields.sourceMethod,
    emotionLevel: fields.emotionLevel,
    type: fields.type,
    priority:
      fields.priority && PRIORITIES.has(fields.priority as IdeaPriority)
        ? (fields.priority as IdeaPriority)
        : undefined,
    relatedProjectId: fields.relatedProjectId,
    relatedIdeaId,
    relatedModule: moduleResolved.module,
    status: fields.status,
    suggestedNextStep: fields.suggestedNextStep,
    decisionNotes,
    evolutionNotes: fields.evolutionNotes,
    relatedAssetsNote: fields.relatedAssetsNote,
    occurredAt: fields.occurredAt,
  });

  return {
    ideaId: idea.id,
    title: idea.title,
    relatedIdeaId: idea.relatedIdeaId,
    parentAutoLinked,
    parentLinkReason,
    parentAlternatives: parentAutoLinked
      ? parentAlternatives.filter((a) => a.id !== relatedIdeaId).slice(0, 3)
      : parentAlternatives.slice(0, 5),
    duplicateSkipped: force,
    pendingModuleFill,
  };
}
