const NOTION_VERSION = "2022-06-28";

export interface NotionRichText {
  plain_text: string;
}

export interface NotionPage {
  id: string;
  url?: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, NotionProperty>;
}

export interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
}

type NotionProperty = {
  type: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  select?: { name: string } | null;
  multi_select?: { name: string }[];
  relation?: { id: string }[];
  url?: string | null;
  date?: { start: string } | null;
  checkbox?: boolean;
  number?: number | null;
};

export class NotionClient {
  constructor(private readonly token: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`https://api.notion.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Notion API ${res.status}: ${body.slice(0, 300)}`);
    }

    return res.json() as Promise<T>;
  }

  async getPage(pageId: string): Promise<NotionPage> {
    return this.request<NotionPage>(`/pages/${pageId}`);
  }

  async queryDatabase(databaseId: string): Promise<NotionPage[]> {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;

    do {
      const data = await this.request<{
        results: NotionPage[];
        has_more: boolean;
        next_cursor: string | null;
      }>(`/databases/${databaseId}/query`, {
        method: "POST",
        body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
      });

      pages.push(...data.results);
      cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
    } while (cursor);

    return pages;
  }

  async listBlockChildren(blockId: string): Promise<NotionBlock[]> {
    const blocks: NotionBlock[] = [];
    let cursor: string | undefined;

    do {
      const data = await this.request<{
        results: NotionBlock[];
        has_more: boolean;
        next_cursor: string | null;
      }>(`/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);

      for (const block of data.results) {
        blocks.push(block);
        if (block.has_children) {
          const nested = await this.listBlockChildren(block.id);
          blocks.push(...nested);
        }
      }

      cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
    } while (cursor);

    return blocks;
  }
}
