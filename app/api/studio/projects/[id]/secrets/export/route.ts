import { requireAdminRole } from "@/lib/auth/require-admin";
import { getProjectById } from "@/lib/studio/data";
import { packSecretsWithPassphrase, secretsToEnvText } from "@/lib/secrets/pack";
import { listProjectSecrets } from "@/lib/secrets/project-secrets";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

type ExportBody = {
  passphrase?: string;
  /** pack=加密包（默认）；env=口令确认后返回明文 .env（配 CF / 本地用） */
  format?: "pack" | "env";
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminRole();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = await readStudioBody<ExportBody>(request);
  const passphrase = (body?.passphrase ?? "").trim();
  const format = body?.format === "env" ? "env" : "pack";

  if (passphrase.length < 6) return studioErr("口令至少 6 位");

  try {
    const [secrets, project] = await Promise.all([
      listProjectSecrets(id),
      getProjectById(id),
    ]);
    const items = secrets.map((s) => ({ name: s.name, value: s.value }));
    if (!items.length) return studioErr("暂无密钥可导出");

    if (format === "env") {
      return studioOk({
        format: "env" as const,
        env: secretsToEnvText(items),
        count: items.length,
      });
    }

    const pack = packSecretsWithPassphrase(items, passphrase, {
      projectId: id,
      projectTitle: project?.title,
    });
    return studioOk({
      format: "pack" as const,
      pack,
      count: items.length,
    });
  } catch (error) {
    return mapStudioError(error);
  }
}
