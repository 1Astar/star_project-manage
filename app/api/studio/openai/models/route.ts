import { getAdminSession } from "@/lib/auth/session";
import { fetchOpenAiModels, pingOpenAi } from "@/lib/studio/ai/openai-client";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

type ModelsBody = {
  openAiApiKey?: string;
  openAiBaseUrl?: string;
  /** true 时只测联通并返回耗时 */
  ping?: boolean;
};

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return studioErr("未登录", 401);

  const body = await readStudioBody<ModelsBody>(request);
  const apiKey = body?.openAiApiKey?.trim();
  if (!apiKey) return studioErr("openAiApiKey 必填");

  try {
    const credentials = {
      apiKey,
      baseUrl: body?.openAiBaseUrl,
    };
    if (body?.ping) {
      const result = await pingOpenAi(credentials);
      return studioOk({ ok: true, ...result });
    }
    const models = await fetchOpenAiModels(credentials);
    return studioOk({ models });
  } catch (error) {
    return mapStudioError(error);
  }
}
