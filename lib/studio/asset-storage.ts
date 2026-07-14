import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { publicStudioAssetUrl } from "@/lib/studio/asset-url";

export async function uploadStudioAssetFile(projectId: string, file: File) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 未配置，无法上传图片");
  }

  const client = createServiceClient();
  if (!client) throw new Error("Supabase 未配置");

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const safeExt = (ext ?? "bin").replace(/[^a-zA-Z0-9]/g, "") || "bin";
  const path = `${projectId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${safeExt}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await client.storage.from("studio-assets").upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) throw new Error(error.message);

  return {
    storagePath: path,
    mimeType: file.type || null,
    url: publicStudioAssetUrl(path),
  };
}

export async function downloadStudioAssetBase64(storagePath: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const client = createServiceClient();
  if (!client) return null;

  const { data, error } = await client.storage.from("studio-assets").download(storagePath);
  if (error || !data) return null;

  const buffer = Buffer.from(await data.arrayBuffer());
  return buffer.toString("base64");
}

export async function restoreStudioAssetFromBase64(
  storagePath: string,
  base64: string,
  mimeType: string | null
) {
  if (!isSupabaseConfigured()) return;
  const client = createServiceClient();
  if (!client) return;

  const buffer = Buffer.from(base64, "base64");
  await client.storage.from("studio-assets").upload(storagePath, buffer, {
    contentType: mimeType || "application/octet-stream",
    upsert: true,
  });
}
