import { normalizeCapturePayload, type IdeaCapturePayload } from "@/lib/studio/idea-capture";
import { createStudioIdea } from "@/lib/studio/mutations";
import type { IdeaPriority } from "@/lib/studio/types";

const PRIORITIES = new Set<IdeaPriority>(["P0", "P1", "P2", "P3"]);

export async function captureIdea(payload: IdeaCapturePayload) {
  const fields = normalizeCapturePayload(payload);

  const idea = await createStudioIdea({
    title: fields.title,
    rawInput: fields.rawThought,
    oneLineIdea: fields.summary,
    whyItMatters: fields.whyItMatters,
    triggerSource: fields.source,
    emotionLevel: fields.emotionLevel,
    type: fields.type,
    priority:
      fields.priority && PRIORITIES.has(fields.priority as IdeaPriority)
        ? (fields.priority as IdeaPriority)
        : undefined,
    relatedProjectId: fields.relatedProjectId,
    status: fields.status,
    suggestedNextStep: fields.suggestedNextStep,
  });

  return {
    ideaId: idea.id,
    title: idea.title,
  };
}
