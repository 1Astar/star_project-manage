import fs from "fs/promises";
import path from "path";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { publicStudioAssetUrl } from "@/lib/studio/asset-url";

export async function uploadStudioAssetFile(projectId: string, file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const safeExt = (ext ?? "bin").replace(/[^a-zA-Z0-9]/g, "") || "bin";
  const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${safeExt}`;
  return uploadStudioAssetBuffer(
    projectId,
    buffer,
    filename,
    file.type || "application/octet-stream"
  );
}

/** Buffer 上传（Excel 内嵌图等）；无 Supabase 时落到 public/import-media */
export async function uploadStudioAssetBuffer(
  projectId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
) {
  const safeName =
    filename.replace(/[^a-zA-Z0-9._-]/g, "") ||
    `${Date.now()}.bin`;

  if (isSupabaseConfigured()) {
    const client = createServiceClient();
    if (!client) throw new Error("Supabase 未配置");
    const storagePath = `${projectId}/${safeName}`;
    const { error } = await client.storage
      .from("studio-assets")
      .upload(storagePath, buffer, {
        contentType: mimeType || "application/octet-stream",
        upsert: false,
      });
    if (error) throw new Error(error.message);
    return {
      storagePath,
      mimeType: mimeType || null,
      url: publicStudioAssetUrl(storagePath),
    };
  }

  const dir = path.join(process.cwd(), "public", "import-media", projectId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, safeName), buffer);
  return {
    storagePath: `local:${projectId}/${safeName}`,
    mimeType: mimeType || null,
    url: `/import-media/${projectId}/${safeName}`,
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
