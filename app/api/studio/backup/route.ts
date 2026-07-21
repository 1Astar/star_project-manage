import { requireAdminRole } from "@/lib/auth/require-admin";
import { exportStudioBackup, importStudioBackup, type StudioBackupPayload } from "@/lib/studio/backup";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function GET() {
  const auth = await requireAdminRole();
  if (auth.error) return auth.error;

  try {
    const backup = await exportStudioBackup();
    const filename = `star-pm-studio-backup-${backup.exportedAt.slice(0, 10)}.json`;
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return mapStudioError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminRole();
  if (auth.error) return auth.error;

  const body = await readStudioBody<StudioBackupPayload>(request);
  if (!body) return studioErr("请求体无效");

  try {
    const result = await importStudioBackup(body);
    return studioOk(result);
  } catch (error) {
    return mapStudioError(error);
  }
}
