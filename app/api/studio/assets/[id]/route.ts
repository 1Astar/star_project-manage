import {
  deleteStudioAsset,
  updateStudioAsset,
  type UpdateAssetInput,
} from "@/lib/studio/mutations";
import { getStudioSnapshot } from "@/lib/studio/store";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { assets } = await getStudioSnapshot();
  const asset = assets.find((a) => a.id === id);
  if (!asset) return studioErr("资料不存在", 404);
  return studioOk({ asset });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await readStudioBody<UpdateAssetInput>(request);
  if (!body) return studioErr("请求体无效");

  try {
    const asset = await updateStudioAsset(id, body);
    return studioOk({ asset });
  } catch (error) {
    return mapStudioError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    await deleteStudioAsset(id);
    return studioOk({ ok: true });
  } catch (error) {
    return mapStudioError(error);
  }
}
