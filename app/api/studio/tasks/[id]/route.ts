import {
  deleteStudioTask,
  updateStudioTask,
  type UpdateTaskInput,
} from "@/lib/studio/mutations";
import { getStudioSnapshot } from "@/lib/studio/store";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { tasks } = await getStudioSnapshot();
  const task = tasks.find((t) => t.id === id);
  if (!task) return studioErr("任务不存在", 404);
  return studioOk({ task });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await readStudioBody<UpdateTaskInput>(request);
  if (!body) return studioErr("请求体无效");

  try {
    const task = await updateStudioTask(id, body);
    return studioOk({ task });
  } catch (error) {
    return mapStudioError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    await deleteStudioTask(id);
    return studioOk({ ok: true });
  } catch (error) {
    return mapStudioError(error);
  }
}
