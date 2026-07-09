import {
  createStudioTask,
  type CreateTaskInput,
} from "@/lib/studio/mutations";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function POST(request: Request) {
  const body = await readStudioBody<CreateTaskInput>(request);
  if (!body?.title || !body?.projectId) return studioErr("title、projectId 必填");

  try {
    const task = await createStudioTask(body);
    return studioOk({ task }, 201);
  } catch (error) {
    return mapStudioError(error);
  }
}
