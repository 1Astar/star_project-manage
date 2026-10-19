import { requireAdminRole } from "@/lib/auth/require-admin";
import { unpackSecretsWithPassphrase } from "@/lib/secrets/pack";
import {
  importProjectSecrets,
  type ImportSecretsMode,
} from "@/lib/secrets/project-secrets";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

type ImportBody = {
  passphrase?: string;
  pack?: string;
  mode?: ImportSecretsMode;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminRole();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = await readStudioBody<ImportBody>(request);
  const passphrase = body?.passphrase ?? "";
  const pack = body?.pack ?? "";
  const mode: ImportSecretsMode = body?.mode === "replace" ? "replace" : "merge";

  if (!pack.trim()) return studioErr("pack 必填");
  if (!passphrase.trim()) return studioErr("passphrase 必填");

  try {
    const payload = unpackSecretsWithPassphrase(pack, passphrase);
    const result = await importProjectSecrets(id, payload.secrets, mode);
    return studioOk({
      ...result,
      sourceProjectId: payload.projectId ?? null,
      sourceProjectTitle: payload.projectTitle ?? null,
      exportedAt: payload.exportedAt,
    });
  } catch (error) {
    return mapStudioError(error);
  }
}
