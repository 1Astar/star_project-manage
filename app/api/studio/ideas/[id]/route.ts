import {
  completeStudioIdea,
  deleteStudioIdea,
  parkStudioIdea,
  updateStudioIdea,
  type UpdateIdeaInput,
} from "@/lib/studio/mutations";
import { getAllIdeas } from "@/lib/studio/data";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

type PatchBody = UpdateIdeaInput & { action?: "park" | "complete" };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const ideas = await getAllIdeas();
  const idea = ideas.find((i) => i.id === id);
  if (!idea) return studioErr("灵感不存在", 404);
  return studioOk({ idea });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await readStudioBody<PatchBody>(request);
  if (!body) return studioErr("请求体无效");

  try {
    if (body.action === "park") {
      const idea = await parkStudioIdea(id);
      return studioOk({ idea });
    }

    if (body.action === "complete") {
      const idea = await completeStudioIdea(id);
      return studioOk({ idea });
    }

    const { action: _action, ...patch } = body;
    const idea = await updateStudioIdea(id, patch);
    return studioOk({ idea });
  } catch (error) {
    return mapStudioError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    await deleteStudioIdea(id);
    return studioOk({ ok: true });
  } catch (error) {
    return mapStudioError(error);
  }
}
