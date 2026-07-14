import { digestIdeasWithOpenAi } from "@/lib/studio/ai/digest-ideas";
import { isIdeaOnDate } from "@/lib/studio/idea-stream-utils";
import { getAllIdeas, getAllProjects } from "@/lib/studio/data";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

type DigestBody = {
  date?: string;
  openAiApiKey?: string;
  openAiModel?: string;
  openAiBaseUrl?: string;
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date") ?? "today";
  const body = await readStudioBody<DigestBody>(request);
  const date = body?.date?.trim() || dateParam;

  try {
    const [ideas, projects] = await Promise.all([getAllIdeas(), getAllProjects()]);
    const dayIdeas = ideas.filter((idea) => isIdeaOnDate(idea.createdAt, date));

    const dateLabel = date === "today" ? "今日" : date;

    const digest = await digestIdeasWithOpenAi(
      { ideas: dayIdeas, projects, dateLabel },
      {
        apiKey: body?.openAiApiKey ?? "",
        model: body?.openAiModel,
        baseUrl: body?.openAiBaseUrl,
      }
    );

    return studioOk({ digest, ideaCount: dayIdeas.length });
  } catch (error) {
    return mapStudioError(error);
  }
}
