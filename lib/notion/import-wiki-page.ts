import { NotionClient } from "@/lib/notion/client";
import { blocksChildrenToMarkdown } from "@/lib/notion/blocks-to-markdown";
import { notionPageUrl } from "@/lib/notion/config";
import { getPageTitle, getPropertyText } from "@/lib/notion/parse";
import { parseNotionPageIdFromInput } from "@/lib/notion/page-id";
import {
  joinPageProps,
  WIKI_PAGE_STATUSES,
  type WikiPageProps,
} from "@/lib/wiki-pages/page-props";
import { createWikiPage } from "@/lib/wiki-pages/store";
import type { ProjectWikiPage, WikiPageHostKind } from "@/lib/types";

export type NotionWikiImportInput = {
  notionToken: string;
  pageUrlOrId: string;
  projectId: string;
  hostKind: WikiPageHostKind;
  hostKey: string;
  parentId?: string | null;
  dryRun?: boolean;
};

export type NotionWikiImportResult = {
  title: string;
  notionPageId: string;
  notionUrl: string;
  bodyPreview: string;
  props: WikiPageProps;
  page: ProjectWikiPage | null;
};

function mapWikiPropsFromNotion(page: Awaited<ReturnType<NotionClient["getPage"]>>): WikiPageProps {
  const statusRaw = getPropertyText(page, "状态", "Status", "status").trim();
  const allowed = WIKI_PAGE_STATUSES as readonly string[];
  const status = allowed.includes(statusRaw)
    ? (statusRaw as WikiPageProps["status"])
    : "";
  const capability = getPropertyText(
    page,
    "核心能力",
    "Capability",
    "capability"
  ).trim();
  return { status, capability };
}

/** 拉取单页 Notion → Markdown，可选写入项目 Wiki */
export async function importNotionPageToWiki(
  input: NotionWikiImportInput
): Promise<NotionWikiImportResult> {
  const token = input.notionToken.trim();
  if (!token) throw new Error("缺少 Notion Token");

  const notionPageId = parseNotionPageIdFromInput(input.pageUrlOrId);
  if (!notionPageId) {
    throw new Error("无法解析 Notion 页面链接或 ID");
  }

  const client = new NotionClient(token);
  const page = await client.getPage(notionPageId);
  const title = getPageTitle(page) || "未命名";
  const markdown = await blocksChildrenToMarkdown(client, notionPageId);
  const props = mapWikiPropsFromNotion(page);
  const notionUrl = page.url ?? notionPageUrl(notionPageId);
  const sourced =
    (markdown ? `${markdown}\n\n` : "") +
    `---\n来源：[Notion](${notionUrl}) · 导入于 ${new Date().toISOString().slice(0, 10)}`;
  const body = joinPageProps(props, sourced);

  if (input.dryRun) {
    return {
      title,
      notionPageId,
      notionUrl,
      bodyPreview: body.slice(0, 2000),
      props,
      page: null,
    };
  }

  const created = await createWikiPage({
    project_id: input.projectId,
    title,
    body,
    parent_id: input.parentId ?? null,
    host_kind: input.hostKind,
    host_key: input.hostKey,
  });

  return {
    title,
    notionPageId,
    notionUrl,
    bodyPreview: body.slice(0, 2000),
    props,
    page: created,
  };
}
