import { requireAdminSession } from "@/lib/auth/require-admin";
import { applyDefaultGitToUnboundProjects } from "@/lib/studio/git-settings";
import { readStudioBody, studioErr, studioOk, mapStudioError } from "@/lib/studio/route-utils";

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const body = await readStudioBody<{ repo?: string; branch?: string }>(request);
  if (!body?.repo) return studioErr("repo 必填");

  try {
    const result = await applyDefaultGitToUnboundProjects(body.repo, body.branch ?? "main");
    return studioOk(result);
  } catch (error) {
    return mapStudioError(error);
  }
}
