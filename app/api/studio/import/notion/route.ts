import { getNotionImportConfig } from "@/lib/notion/config";
import { fetchNotionStudioSnapshot } from "@/lib/notion/import-studio";
import { upsertStudioSnapshot } from "@/lib/studio/store";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

type ImportBody = {
  dryRun?: boolean;
  /** 浏览器 localStorage 传入，不落库 */
  notionToken?: string;
};

/** 预览：只拉 Notion，不写库（需 POST 带 token；GET 保留兼容，仅 env 有 token 时可用） */
export async function GET() {
  const config = getNotionImportConfig();
  if (!config) {
    return studioErr("Notion Token 未配置。请在设置页填写并保存到本机", 503);
  }

  try {
    const result = await fetchNotionStudioSnapshot(config);
    return studioOk({
      preview: true,
      stats: result.stats,
      warnings: result.warnings,
      pendingModuleFill: result.pendingModuleFill,
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

/** 导入：拉 Notion → upsert Supabase（或内存） */
export async function POST(request: Request) {
  const body = await readStudioBody<ImportBody>(request);
  const config = getNotionImportConfig(body?.notionToken);

  if (!config) {
    return studioErr(
      "Notion Token 未配置。请在设置页填写并保存到本机（仅浏览器 localStorage），并把 Integration 连接到 Notion 页面/数据库",
      503
    );
  }

  try {
    const result = await fetchNotionStudioSnapshot(config);

    if (result.stats.projects + result.stats.ideas === 0) {
      return studioErr(
        "Notion 未返回可导入的数据。请确认 Integration 已连接页面/数据库，且数据库/页面 ID 配置正确",
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
      pendingModuleFill: result.pendingModuleFill,
    });
  } catch (error) {
    return mapStudioError(error);
  }
}
