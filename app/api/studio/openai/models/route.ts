import { fetchOpenAiModels } from "@/lib/studio/ai/openai-client";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

type ModelsBody = {
  openAiApiKey?: string;
  openAiBaseUrl?: string;
};

export async function POST(request: Request) {
  const body = await readStudioBody<ModelsBody>(request);
  const apiKey = body?.openAiApiKey?.trim();
  if (!apiKey) return studioErr("openAiApiKey 必填");

  try {
    const models = await fetchOpenAiModels({
      apiKey,
      baseUrl: body?.openAiBaseUrl,
    });
    return studioOk({ models });
  } catch (error) {
    return mapStudioError(error);
  }
}
