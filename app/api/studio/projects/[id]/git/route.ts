import { requireAdminSession } from "@/lib/auth/require-admin";
import { saveStudioGitSettings, type SaveStudioGitInput } from "@/lib/studio/git-settings";
import { syncStudioProjectGit } from "@/lib/studio/git-sync";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = await readStudioBody<Omit<SaveStudioGitInput, "projectId">>(request);
  if (!body) return studioErr("请求体无效");

  try {
    const project = await saveStudioGitSettings({ projectId: id, ...body });
    return studioOk({ project });
  } catch (error) {
    return mapStudioError(error);
  }
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const result = await syncStudioProjectGit(id);
    return studioOk(result);
  } catch (error) {
    return mapStudioError(error);
  }
}
