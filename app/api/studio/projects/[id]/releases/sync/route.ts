import { requireAdminSession } from "@/lib/auth/require-admin";
import { syncStudioProjectReleases } from "@/lib/studio/mutations";
import { mapStudioError, studioOk } from "@/lib/studio/route-utils";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  try {
    const result = await syncStudioProjectReleases(id);
    return studioOk(result);
  } catch (error) {
    return mapStudioError(error);
  }
}
