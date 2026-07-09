export function isNotionConfigured(): boolean {
  return Boolean(process.env.NOTION_TOKEN?.trim());
}

/** 32 位 hex → UUID */
export function notionIdToUuid(raw: string): string {
  const id = raw.replace(/-/g, "").trim();
  if (id.length !== 32) return raw;
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

export function studioIdFromNotion(prefix: string, notionId: string): string {
  const compact = notionId.replace(/-/g, "");
  return `${prefix}${compact}`;
}

export function notionPageUrl(pageId: string): string {
  const compact = pageId.replace(/-/g, "");
  return `https://www.notion.so/${compact}`;
}

export interface NotionImportConfig {
  token: string;
  ideaDatabaseId: string | null;
  evolutionDatabaseId: string | null;
  projectPageIds: string[];
}

export function getNotionImportConfig(): NotionImportConfig | null {
  const token = process.env.NOTION_TOKEN?.trim();
  if (!token) return null;

  const ideaDatabaseId =
    process.env.NOTION_IDEA_DATABASE_ID?.trim() ||
    "90c63edb-e2ae-4997-ba6d-b7b6c7367f8a";

  const evolutionDatabaseId = process.env.NOTION_EVOLUTION_DATABASE_ID?.trim() || null;

  const projectPagesRaw =
    process.env.NOTION_PROJECT_PAGE_IDS?.trim() ||
    "395a86f5-0915-810a-9bf2-da9551d6e782";

  const projectPageIds = projectPagesRaw
    .split(",")
    .map((s) => notionIdToUuid(s.trim()))
    .filter(Boolean);

  return {
    token,
    ideaDatabaseId: ideaDatabaseId ? notionIdToUuid(ideaDatabaseId) : null,
    evolutionDatabaseId: evolutionDatabaseId ? notionIdToUuid(evolutionDatabaseId) : null,
    projectPageIds,
  };
}
