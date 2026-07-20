import { requireAdminSession } from "@/lib/auth/require-admin";
import { importChangelogAsEvolution } from "@/lib/studio/mutations";
import { mapStudioError, readStudioBody, studioOk } from "@/lib/studio/route-utils";

/** 从 CHANGELOG markdown 导入各版本条目为演进（关键词推断板块） */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = await readStudioBody<{ markdown?: string; fromRepoFile?: boolean }>(
    request
  );

  try {
    const result = await importChangelogAsEvolution({
      projectId: id,
      markdown: body?.markdown,
      fromRepoFile: body?.fromRepoFile,
    });
    return studioOk(result);
  } catch (error) {
    return mapStudioError(error);
  }
}
