import { publicStudioAssetUrl } from "@/lib/studio/asset-url";

/** Resolve iframe/download URL from DB storage_path (legacy path, bucket key, or full URL). */
export function resolvePrototypeUrl(storagePath: string | null | undefined): string {
  if (!storagePath) return "";
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  if (storagePath.startsWith("/")) return storagePath;
  return publicStudioAssetUrl(storagePath);
}
