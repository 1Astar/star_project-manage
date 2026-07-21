import { requireKeysAccess } from "@/lib/auth/require-admin";
import {
  deleteProjectSecret,
  updateProjectSecret,
  type UpsertProjectSecretInput,
} from "@/lib/secrets/project-secrets";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; secretId: string }> }
) {
  const auth = await requireKeysAccess();
  if (auth.error) return auth.error;

  const { id, secretId } = await context.params;
  const body = await readStudioBody<Partial<UpsertProjectSecretInput>>(request);
  if (!body) return studioErr("请求体无效");

  try {
    const secret = await updateProjectSecret(id, secretId, body);
    return studioOk({ secret });
  } catch (error) {
    return mapStudioError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; secretId: string }> }
) {
  const auth = await requireKeysAccess();
  if (auth.error) return auth.error;

  const { id, secretId } = await context.params;

  try {
    await deleteProjectSecret(id, secretId);
    return studioOk({ ok: true });
  } catch (error) {
    return mapStudioError(error);
  }
}
