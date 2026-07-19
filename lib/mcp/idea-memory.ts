import type { Idea, IdeaStatus } from "@/lib/studio/types";
import { IDEA_STATUS_LABELS } from "@/lib/studio/types";

function includesIgnoreCase(haystack: string | null | undefined, needle: string) {
  return (haystack ?? "").toLowerCase().includes(needle);
}

/** 灵感记忆检索：标题 / 原文 / AI 补充 / 来源 / 模块等 */
export function searchIdeas(ideas: Idea[], query: string, limit = 20): Idea[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored = ideas
    .map((idea) => {
      const fields = [
        idea.title,
        idea.oneLineIdea,
        idea.whyItMatters,
        idea.aiSupplement,
        idea.rawInput,
        idea.chatTopic,
        idea.sourceChat,
        idea.sourceMethod,
        idea.triggerSource,
        idea.relatedModule,
        idea.decisionNotes,
        idea.evolutionNotes,
        idea.relatedAssetsNote,
        idea.suggestedNextStep,
      ];
      const hit = fields.some((f) => includesIgnoreCase(f, q));
      if (!hit) return null;
      const titleHit = includesIgnoreCase(idea.title, q) ? 2 : 0;
      const recent = idea.occurredAt || idea.createdAt;
      return { idea, score: titleHit, recent };
    })
    .filter((item): item is { idea: Idea; score: number; recent: string } => !!item);

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.recent.localeCompare(a.recent);
  });

  return scored.slice(0, limit).map((s) => s.idea);
}

export function formatIdeaMemory(idea: Idea, projectTitle?: string | null) {
  return {
    id: idea.id,
    title: idea.title,
    summary: idea.oneLineIdea || idea.aiSupplement || null,
    rawThought: idea.rawInput || null,
    aiSupplement: idea.aiSupplement || idea.whyItMatters || null,
    chatTopic: idea.chatTopic || null,
    occurredAt: idea.occurredAt,
    source: {
      chat: idea.sourceChat || null,
      method: idea.sourceMethod || idea.triggerSource || null,
      time: idea.occurredAt,
    },
    relations: {
      projectId: idea.relatedProjectId,
      projectTitle: projectTitle ?? null,
      module: idea.relatedModule || null,
      parentIdeaId: idea.relatedIdeaId,
    },
    status: idea.status,
    statusLabel: IDEA_STATUS_LABELS[idea.status as IdeaStatus] ?? idea.status,
    type: idea.type,
    priority: idea.priority,
    sediment: {
      decision: idea.decisionNotes || null,
      evolution: idea.evolutionNotes || null,
      assets: idea.relatedAssetsNote || null,
    },
    completedAt: idea.completedAt,
    createdAt: idea.createdAt,
  };
}
