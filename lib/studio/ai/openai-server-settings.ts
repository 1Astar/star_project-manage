import { getAppSetting, upsertAppSetting } from "@/lib/studio/app-settings";
import {
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  type OpenAiSettings,
} from "@/lib/studio/ai/openai-settings";
import type { OpenAiCredentials } from "@/lib/studio/ai/openai-client";

export const OPENAI_SERVER_SETTINGS_KEY = "openai_server_settings";

export type OpenAiServerSettings = {
  apiKey: string;
  model: string;
  baseUrl: string;
  updatedAt?: string;
};

function normalize(raw: unknown): OpenAiServerSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Partial<OpenAiServerSettings>;
  const apiKey = typeof obj.apiKey === "string" ? obj.apiKey.trim() : "";
  if (!apiKey) return null;
  return {
    apiKey,
    model: (typeof obj.model === "string" && obj.model.trim()) || DEFAULT_OPENAI_MODEL,
    baseUrl:
      (typeof obj.baseUrl === "string" && obj.baseUrl.trim()) || DEFAULT_OPENAI_BASE_URL,
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : undefined,
  };
}

/** 服务端可读：app_settings → 环境变量兜底 */
export async function loadServerOpenAiSettings(): Promise<OpenAiServerSettings | null> {
  try {
    const row = await getAppSetting(OPENAI_SERVER_SETTINGS_KEY);
    const fromDb = normalize(row?.value);
    if (fromDb) return fromDb;
  } catch {
    // ignore and fall through
  }

  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (!envKey) return null;
  return {
    apiKey: envKey,
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    baseUrl: process.env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL,
  };
}

export async function saveServerOpenAiSettings(
  settings: OpenAiSettings
): Promise<OpenAiServerSettings> {
  const next: OpenAiServerSettings = {
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim() || DEFAULT_OPENAI_MODEL,
    baseUrl: settings.baseUrl?.trim() || DEFAULT_OPENAI_BASE_URL,
    updatedAt: new Date().toISOString(),
  };
  if (!next.apiKey) throw new Error("API Key 必填");
  await upsertAppSetting(OPENAI_SERVER_SETTINGS_KEY, next);
  return next;
}

export async function clearServerOpenAiSettings(): Promise<void> {
  await upsertAppSetting(OPENAI_SERVER_SETTINGS_KEY, {});
}

export async function serverOpenAiCredentials(): Promise<OpenAiCredentials | null> {
  const settings = await loadServerOpenAiSettings();
  if (!settings) return null;
  return {
    apiKey: settings.apiKey,
    model: settings.model,
    baseUrl: settings.baseUrl,
  };
}
