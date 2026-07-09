export const OPENAI_SETTINGS_STORAGE_KEY = "star-pm:openai-settings:v1";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export const OPENAI_MODEL_OPTIONS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
] as const;

export type OpenAiSettings = {
  apiKey: string;
  model: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadOpenAiSettings(): OpenAiSettings | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(OPENAI_SETTINGS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<OpenAiSettings>;
    const apiKey = parsed.apiKey?.trim() ?? "";
    if (!apiKey) return null;

    return {
      apiKey,
      model: parsed.model?.trim() || DEFAULT_OPENAI_MODEL,
    };
  } catch {
    return null;
  }
}

export function saveOpenAiSettings(settings: OpenAiSettings): void {
  if (!canUseStorage()) return;

  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    clearOpenAiSettings();
    return;
  }

  try {
    window.localStorage.setItem(
      OPENAI_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        apiKey,
        model: settings.model.trim() || DEFAULT_OPENAI_MODEL,
      } satisfies OpenAiSettings)
    );
  } catch {
    // quota / private mode
  }
}

export function clearOpenAiSettings(): void {
  if (!canUseStorage()) return;

  try {
    window.localStorage.removeItem(OPENAI_SETTINGS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 3)}••••${trimmed.slice(-4)}`;
}
