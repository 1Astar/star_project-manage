import {
  updateChangeSession,
  type UpdateChangeSessionInput,
} from "@/lib/studio/mutations";
import { getChangeSessionById } from "@/lib/studio/data";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getChangeSessionById(id);
  if (!session) return studioErr("变更会话不存在", 404);
  return studioOk({ session });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await readStudioBody<UpdateChangeSessionInput>(request);
  if (!body) return studioErr("请求体无效");

  try {
    const session = await updateChangeSession(id, body);
    return studioOk({ session });
  } catch (error) {
    return mapStudioError(error);
  }
}
