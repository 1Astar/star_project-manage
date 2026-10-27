import { notionIdToUuid } from "@/lib/notion/config";

/**
 * 从 Notion 分享链接或裸 ID 解析 page/database UUID。
 * 支持：完整 URL、带标题后缀的 path、32 hex、带短横线 UUID。
 */
export function parseNotionPageIdFromInput(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)
  ) {
    return raw.toLowerCase();
  }

  if (/^[0-9a-f]{32}$/i.test(raw)) {
    return notionIdToUuid(raw).toLowerCase();
  }

  try {
    const href = raw.includes("://") ? raw : `https://${raw}`;
    const u = new URL(href);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const m = last.match(/([0-9a-f]{32})$/i);
    if (m?.[1]) return notionIdToUuid(m[1]).toLowerCase();
  } catch {
    /* not a URL */
  }

  const loose = raw.match(/([0-9a-f]{32})/i);
  if (loose?.[1]) return notionIdToUuid(loose[1]).toLowerCase();

  return null;
}
