export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export type OpenAiCredentials = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
};

export function normalizeOpenAiBaseUrl(baseUrl?: string | null): string {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return DEFAULT_OPENAI_BASE_URL;
  return trimmed.replace(/\/+$/, "");
}

export function resolveOpenAiCredentials(credentials: OpenAiCredentials) {
  const apiKey = credentials.apiKey?.trim();
  if (!apiKey) throw new Error("请先在页面配置 OpenAI API Key");

  return {
    apiKey,
    model: credentials.model?.trim() || "gpt-4o-mini",
    baseUrl: normalizeOpenAiBaseUrl(credentials.baseUrl),
  };
}

function sortModelIds(ids: string[]): string[] {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const preferred = unique.filter((id) =>
    /^(gpt-|o[0-9]|chatgpt)/i.test(id) && !/instruct|realtime|audio|transcribe|tts|embedding|whisper|dall-e|moderation|davinci|babbage|curie|ada/i.test(id)
  );
  const rest = unique.filter((id) => !preferred.includes(id));
  return [...preferred.sort(), ...rest.sort()];
}

export async function fetchOpenAiModels(credentials: OpenAiCredentials): Promise<string[]> {
  const { apiKey, baseUrl } = resolveOpenAiCredentials(credentials);
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`拉取模型失败 (${response.status}): ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ id?: string }>;
  };
  const ids = (payload.data ?? []).map((item) => item.id?.trim() ?? "").filter(Boolean);
  if (ids.length === 0) throw new Error("接口未返回可用模型");

  return sortModelIds(ids);
}
