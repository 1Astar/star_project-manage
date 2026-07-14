import { getStudioSnapshot, invalidateStudioCache, upsertStudioSnapshot } from "@/lib/studio/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  downloadStudioAssetBase64,
  restoreStudioAssetFromBase64,
} from "@/lib/studio/asset-storage";
import type { StudioSnapshot } from "@/lib/studio/store";

export const STUDIO_BACKUP_VERSION = 1;

export type StudioBackupFile = {
  storagePath: string;
  mimeType: string | null;
  base64: string;
};

export type StudioBackupPayload = {
  version: number;
  exportedAt: string;
  snapshot: StudioSnapshot;
  files: StudioBackupFile[];
};

export async function exportStudioBackup(): Promise<StudioBackupPayload> {
  const snapshot = await getStudioSnapshot();
  const files: StudioBackupFile[] = [];

  if (isSupabaseConfigured()) {
    for (const asset of snapshot.assets) {
      if (!asset.storagePath) continue;
      const base64 = await downloadStudioAssetBase64(asset.storagePath);
      if (!base64) continue;
      files.push({
        storagePath: asset.storagePath,
        mimeType: asset.mimeType,
        base64,
      });
    }
  }

  return {
    version: STUDIO_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    snapshot,
    files,
  };
}

export async function importStudioBackup(payload: StudioBackupPayload) {
  if (payload.version !== STUDIO_BACKUP_VERSION) {
    throw new Error(`不支持的备份版本：${payload.version}`);
  }
  if (!payload.snapshot?.projects) {
    throw new Error("备份文件缺少 snapshot");
  }

  if (isSupabaseConfigured()) {
    await upsertStudioSnapshot(payload.snapshot);

    for (const file of payload.files ?? []) {
      if (file.storagePath && file.base64) {
        await restoreStudioAssetFromBase64(file.storagePath, file.base64, file.mimeType);
      }
    }
    invalidateStudioCache();
    return { ok: true as const, mode: "supabase" as const };
  }

  const { applyMemoryMutation } = await import("@/lib/studio/store");
  applyMemoryMutation((mem) => {
    mem.projects = payload.snapshot.projects;
    mem.ideas = payload.snapshot.ideas;
    mem.evolutionLogs = payload.snapshot.evolutionLogs;
    mem.tasks = payload.snapshot.tasks;
    mem.assets = payload.snapshot.assets;
  });
  invalidateStudioCache();
  return { ok: true as const, mode: "memory" as const };
}
