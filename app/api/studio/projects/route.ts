import {
  createStudioProject,
  type CreateProjectInput,
} from "@/lib/studio/mutations";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function POST(request: Request) {
  const body = await readStudioBody<CreateProjectInput>(request);
  if (!body?.title) return studioErr("title 必填");

  try {
    const project = await createStudioProject(body);
    return studioOk({ project }, 201);
  } catch (error) {
    return mapStudioError(error);
  }
}
