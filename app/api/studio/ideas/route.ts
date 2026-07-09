import {
  convertIdeaToProject,
  createStudioIdea,
  type CreateIdeaInput,
  type CreateProjectInput,
} from "@/lib/studio/mutations";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

type CreateIdeaBody = CreateIdeaInput & {
  action?: "convert";
  project?: CreateProjectInput;
  syncSubtasksToProject?: boolean;
};

export async function POST(request: Request) {
  const body = await readStudioBody<CreateIdeaBody>(request);
  if (!body?.title) return studioErr("title 必填");

  try {
    if (body.action === "convert") {
      const idea = await createStudioIdea(body);
      const result = await convertIdeaToProject(idea.id, body.project);
      return studioOk(result, 201);
    }

    const idea = await createStudioIdea(body);
    return studioOk({ idea }, 201);
  } catch (error) {
    return mapStudioError(error);
  }
}
