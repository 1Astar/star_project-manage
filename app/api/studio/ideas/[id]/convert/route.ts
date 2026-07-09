import {
  convertIdeaToProject,
  type CreateProjectInput,
} from "@/lib/studio/mutations";
import { mapStudioError, readStudioBody, studioOk } from "@/lib/studio/route-utils";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await readStudioBody<{ project?: CreateProjectInput }>(request);

  try {
    const result = await convertIdeaToProject(id, body?.project);
    return studioOk(result, 201);
  } catch (error) {
    return mapStudioError(error);
  }
}
