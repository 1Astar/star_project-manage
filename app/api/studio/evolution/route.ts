import {
  createStudioEvolution,
  type CreateEvolutionInput,
} from "@/lib/studio/mutations";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function POST(request: Request) {
  const body = await readStudioBody<CreateEvolutionInput>(request);
  if (!body?.title || !body?.projectId || !body?.logType) {
    return studioErr("title、projectId、logType 必填");
  }

  try {
    const log = await createStudioEvolution(body);
    return studioOk({ log }, 201);
  } catch (error) {
    return mapStudioError(error);
  }
}
