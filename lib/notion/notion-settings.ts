/** 浏览器本地 Notion 导入配置（不写服务端 / DB） */

export const NOTION_SETTINGS_STORAGE_KEY = "star-pm:notion-settings:v1";

export type NotionSettings = {
  token: string;
};

export function loadNotionSettings(): NotionSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(NOTION_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NotionSettings>;
    const token = parsed.token?.trim() ?? "";
    if (!token) return null;
    return { token };
  } catch {
    return null;
  }
}

export function saveNotionSettings(settings: NotionSettings): void {
  const token = settings.token.trim();
  if (!token) {
    clearNotionSettings();
    return;
  }
  window.localStorage.setItem(NOTION_SETTINGS_STORAGE_KEY, JSON.stringify({ token }));
}

export function clearNotionSettings(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(NOTION_SETTINGS_STORAGE_KEY);
}

export function maskNotionToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 10) return "••••••••";
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}
