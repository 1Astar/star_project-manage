import { NextResponse } from "next/server";
import { isNotionConfigured, getNotionImportConfig } from "@/lib/notion/config";
import { fetchNotionStudioSnapshot } from "@/lib/notion/import-studio";
import { upsertStudioSnapshot } from "@/lib/studio/store";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

/** 预览：只拉 Notion，不写库 */
export async function GET() {
  if (!isNotionConfigured()) {
    return studioErr("NOTION_TOKEN 未配置", 503);
  }

  const config = getNotionImportConfig();
  if (!config) return studioErr("Notion 配置无效", 503);

  try {
    const result = await fetchNotionStudioSnapshot(config);
    return studioOk({
      preview: true,
      stats: result.stats,
      warnings: result.warnings,
      projects: result.snapshot.projects.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        relatedPageUrl: p.relatedPageUrl,
      })),
    });
  } catch (error) {
    return mapStudioError(error);
  }
}

type ImportBody = {
  dryRun?: boolean;
};

/** 导入：拉 Notion → upsert Supabase（或内存） */
export async function POST(request: Request) {
  if (!isNotionConfigured()) {
    return studioErr("NOTION_TOKEN 未配置。请在 .env.local 设置 NOTION_TOKEN，并把 Integration 连接到 Notion 页面/数据库", 503);
  }

  const config = getNotionImportConfig();
  if (!config) return studioErr("Notion 配置无效", 503);

  const body = await readStudioBody<ImportBody>(request);

  try {
    const result = await fetchNotionStudioSnapshot(config);

    if (result.stats.projects + result.stats.ideas === 0) {
      return studioErr(
        "Notion 未返回可导入的数据。请确认 Integration 已连接页面/数据库，且 NOTION_IDEA_DATABASE_ID / NOTION_PROJECT_PAGE_IDS 正确",
        400
      );
    }

    if (!body?.dryRun) {
      await upsertStudioSnapshot(result.snapshot);
    }

    return studioOk({
      imported: !body?.dryRun,
      stats: result.stats,
      warnings: result.warnings,
    });
  } catch (error) {
    return mapStudioError(error);
  }
}
