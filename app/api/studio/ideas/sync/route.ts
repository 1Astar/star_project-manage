import { syncIdeasFromGitHub } from "@/lib/github/sync-ideas";
import { mapStudioError, studioOk } from "@/lib/studio/route-utils";

export async function POST() {
  try {
    const result = await syncIdeasFromGitHub();
    return studioOk(result);
  } catch (error) {
    return mapStudioError(error);
  }
}
