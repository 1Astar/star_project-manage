import {
  createStudioAsset,
  type CreateAssetInput,
} from "@/lib/studio/mutations";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function POST(request: Request) {
  const body = await readStudioBody<CreateAssetInput>(request);
  if (!body?.title || !body?.projectId) return studioErr("title、projectId 必填");

  try {
    const asset = await createStudioAsset(body);
    return studioOk({ asset }, 201);
  } catch (error) {
    return mapStudioError(error);
  }
}
