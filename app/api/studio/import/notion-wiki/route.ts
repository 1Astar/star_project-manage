import { requireAdminRole } from "@/lib/auth/require-admin";
import { importNotionPageToWiki } from "@/lib/notion/import-wiki-page";
import { getNotionImportConfig } from "@/lib/notion/config";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";
import type { WikiPageHostKind } from "@/lib/types";

type Body = {
  dryRun?: boolean;
  notionToken?: string;
  pageUrlOrId?: string;
  projectId?: string;
  hostKind?: WikiPageHostKind;
  hostKey?: string;
  parentId?: string | null;
};

const HOST_KINDS: WikiPageHostKind[] = [
  "module",
  "requirement",
  "bug",
  "learning",
  "prd",
  "competitor",
];

export async function POST(request: Request) {
  const auth = await requireAdminRole();
  if (auth.error) return auth.error;

  const body = await readStudioBody<Body>(request);
  const config = getNotionImportConfig(body?.notionToken);
  if (!config) {
    return studioErr(
      "Notion Token 未配置。请在设置页填写并保存到本机，或在此请求传入 notionToken",
      503
    );
  }

  const pageUrlOrId = body?.pageUrlOrId?.trim() ?? "";
  const projectId = body?.projectId?.trim() ?? "";
  const hostKind = body?.hostKind;
  const hostKey = body?.hostKey?.trim() ?? "";

  if (!pageUrlOrId) return studioErr("请提供 Notion 页面链接或 ID");
  if (!projectId) return studioErr("请提供 projectId");
  if (!hostKind || !HOST_KINDS.includes(hostKind)) {
    return studioErr("hostKind 无效");
  }
  if (!hostKey) return studioErr("hostKey 不能为空");

  try {
    const result = await importNotionPageToWiki({
      notionToken: config.token,
      pageUrlOrId,
      projectId,
      hostKind,
      hostKey,
      parentId: body?.parentId ?? null,
      dryRun: Boolean(body?.dryRun),
    });

    return studioOk({
      imported: !body?.dryRun && Boolean(result.page),
      title: result.title,
      notionPageId: result.notionPageId,
      notionUrl: result.notionUrl,
      props: result.props,
      bodyPreview: result.bodyPreview,
      page: result.page
        ? { id: result.page.id, title: result.page.title, host_kind: result.page.host_kind }
        : null,
    });
  } catch (error) {
    return mapStudioError(error);
  }
}
