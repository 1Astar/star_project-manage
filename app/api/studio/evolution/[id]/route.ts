import {
  deleteStudioEvolution,
  updateStudioEvolution,
  type UpdateEvolutionInput,
} from "@/lib/studio/mutations";
import { getAllEvolutionLogs } from "@/lib/studio/data";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const logs = await getAllEvolutionLogs();
  const log = logs.find((e) => e.id === id);
  if (!log) return studioErr("演进记录不存在", 404);
  return studioOk({ log });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await readStudioBody<UpdateEvolutionInput>(request);
  if (!body) return studioErr("请求体无效");

  try {
    const log = await updateStudioEvolution(id, body);
    return studioOk({ log });
  } catch (error) {
    return mapStudioError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    await deleteStudioEvolution(id);
    return studioOk({ ok: true });
  } catch (error) {
    return mapStudioError(error);
  }
}
