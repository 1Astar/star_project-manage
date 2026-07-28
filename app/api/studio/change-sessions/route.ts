import {
  createChangeSession,
  type CreateChangeSessionInput,
} from "@/lib/studio/mutations";
import { getProjectChangeSessions } from "@/lib/studio/data";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim();
  if (!projectId) return studioErr("projectId 必填");
  const day = searchParams.get("day")?.trim() || undefined;
  const sessions = await getProjectChangeSessions(projectId, day);
  return studioOk({ sessions });
}

export async function POST(request: Request) {
  const body = await readStudioBody<CreateChangeSessionInput>(request);
  if (!body?.projectId || !body?.goal?.trim()) {
    return studioErr("projectId、goal 必填");
  }

  try {
    const session = await createChangeSession(body);
    return studioOk({ session }, 201);
  } catch (error) {
    return mapStudioError(error);
  }
}
