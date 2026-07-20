import { requireAdminSession } from "@/lib/auth/require-admin";
import { publishStudioProjectRelease } from "@/lib/studio/mutations";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

type Body = {
  tag?: string;
  name?: string;
  targetCommitish?: string;
  extraBody?: string;
  attachUntaggedEvolution?: boolean;
  draft?: boolean;
  prerelease?: boolean;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = await readStudioBody<Body>(request);
  if (!body?.tag?.trim()) return studioErr("tag 必填");

  try {
    const result = await publishStudioProjectRelease({
      projectId: id,
      tag: body.tag.trim(),
      name: body.name,
      targetCommitish: body.targetCommitish,
      extraBody: body.extraBody,
      attachUntaggedEvolution: body.attachUntaggedEvolution,
      draft: body.draft,
      prerelease: body.prerelease,
    });
    return studioOk(result, 201);
  } catch (error) {
    return mapStudioError(error);
  }
}
