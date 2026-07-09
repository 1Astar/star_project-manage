import {
  deleteStudioProject,
  updateStudioProject,
  type UpdateProjectInput,
} from "@/lib/studio/mutations";
import { getProjectById } from "@/lib/studio/data";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const project = await getProjectById(id);
  if (!project) return studioErr("项目不存在", 404);
  return studioOk({ project });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await readStudioBody<UpdateProjectInput>(request);
  if (!body) return studioErr("请求体无效");

  try {
    const project = await updateStudioProject(id, body);
    return studioOk({ project });
  } catch (error) {
    return mapStudioError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    await deleteStudioProject(id);
    return studioOk({ ok: true });
  } catch (error) {
    return mapStudioError(error);
  }
}
