import { requireAdminRole } from "@/lib/auth/require-admin";
import {
  createProjectSecret,
  listProjectSecrets,
  type UpsertProjectSecretInput,
} from "@/lib/secrets/project-secrets";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminRole();
  if (auth.error) return auth.error;

  const { id } = await context.params;

  try {
    const secrets = await listProjectSecrets(id);
    return studioOk({ secrets });
  } catch (error) {
    return mapStudioError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminRole();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = await readStudioBody<UpsertProjectSecretInput>(request);
  if (!body?.name || body.value === undefined) {
    return studioErr("name、value 必填");
  }

  try {
    const secret = await createProjectSecret(id, body);
    return studioOk({ secret }, 201);
  } catch (error) {
    return mapStudioError(error);
  }
}
