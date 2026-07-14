import { analyzeIdeaWithOpenAi, type AnalyzeIdeaContext } from "@/lib/studio/ai/analyze-idea";
import { getAllIdeas, getProjectById } from "@/lib/studio/data";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";
import type { EmotionLevel } from "@/lib/studio/types";
type AnalyzeBody = {
  rawInput?: string;
  whyThought?: string;
  emotionLevel?: string;
  preferPark?: boolean;
  relatedProjectId?: string | null;
  relatedIdeaId?: string | null;
  openAiApiKey?: string;
  openAiModel?: string;
  openAiBaseUrl?: string;
};

export async function POST(request: Request) {
  const body = await readStudioBody<AnalyzeBody>(request);
  const rawInput = body?.rawInput?.trim();
  if (!rawInput) return studioErr("rawInput 必填");

  const relatedProjectId = body?.relatedProjectId?.trim() || null;
  const relatedIdeaId = body?.relatedIdeaId?.trim() || null;

  if (relatedProjectId && relatedIdeaId) {
    return studioErr("只能关联项目或灵感其中之一");
  }

  try {
    const context: AnalyzeIdeaContext = {
      rawInput,
      whyThought: body?.whyThought?.trim(),
      emotionLevel: body?.emotionLevel as EmotionLevel | undefined,
      preferPark: body?.preferPark === true,
    };
    if (relatedProjectId) {
      const project = await getProjectById(relatedProjectId);
      if (!project) return studioErr("关联项目不存在", 404);
      context.relatedProject = {
        title: project.title,
        positioning: project.positioning,
        status: project.status,
        priority: project.priority,
        nextAction: project.nextAction,
      };
    }

    if (relatedIdeaId) {
      const ideas = await getAllIdeas();
      const idea = ideas.find((item) => item.id === relatedIdeaId);
      if (!idea) return studioErr("关联灵感不存在", 404);
      context.relatedIdea = {
        title: idea.title,
        oneLineIdea: idea.oneLineIdea,
        whyItMatters: idea.whyItMatters,
        priority: idea.priority,
        type: idea.type,
      };
    }

    const analysis = await analyzeIdeaWithOpenAi(context, {
      apiKey: body?.openAiApiKey ?? "",
      model: body?.openAiModel,
      baseUrl: body?.openAiBaseUrl,
    });
    return studioOk({ analysis });
  } catch (error) {
    return mapStudioError(error);
  }
}
