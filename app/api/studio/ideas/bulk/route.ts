import { bulkArchiveStudioIdeas } from "@/lib/studio/mutations";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

type BulkBody = {
  action?: "archive";
  ids?: string[];
};

/** 多选批量操作：目前仅支持归档（不做硬删除） */
export async function POST(request: Request) {
  const body = await readStudioBody<BulkBody>(request);
  if (!body) return studioErr("请求体无效");
  if (body.action !== "archive") return studioErr("不支持的 action，仅支持 archive");
  const ids = body.ids ?? [];
  if (!ids.length) return studioErr("ids 不能为空");

  try {
    const result = await bulkArchiveStudioIdeas(ids);
    return studioOk(result);
  } catch (error) {
    return mapStudioError(error);
  }
}
