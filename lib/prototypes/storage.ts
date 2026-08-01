import fs from "fs/promises";
import path from "path";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { publicStudioAssetUrl } from "@/lib/studio/asset-url";
import { isProductionLikeRuntime } from "@/lib/runtime/serverless";
import type { Project } from "@/lib/types";

const BUCKET = "studio-assets";
const PROTOTYPE_PREFIX = "prototypes";
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "prototypes");

export function prototypeObjectPath(projectSlug: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "") || "upload.zip";
  return `${PROTOTYPE_PREFIX}/${projectSlug}-${Date.now()}/${safeName}`;
}

async function uploadPrototypeZipLocal(
  project: Pick<Project, "slug">,
  bytes: Buffer
): Promise<{ storage_path: string; url: string; type: "html_zip" }> {
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  const dirName = `${project.slug}-${Date.now()}`;
  const dirPath = path.join(LOCAL_UPLOAD_DIR, dirName);
  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(path.join(dirPath, "upload.zip"), bytes);
  const publicPath = `/prototypes/${dirName}/upload.zip`;
  return { storage_path: publicPath, url: publicPath, type: "html_zip" };
}

export async function uploadPrototypeZip(
  project: Pick<Project, "id" | "slug">,
  bytes: Buffer | Uint8Array,
  filename = "upload.zip"
): Promise<{ storage_path: string; url: string; type: "html_zip" }> {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);

  if (isSupabaseConfigured()) {
    const client = createServiceClient();
    if (!client) throw new Error("Supabase 未配置，无法上传原型 ZIP");

    const objectPath = prototypeObjectPath(project.slug, filename);
    const { error } = await client.storage.from(BUCKET).upload(objectPath, buffer, {
      contentType: "application/zip",
      upsert: false,
    });
    if (error) throw new Error(error.message);

    const url = publicStudioAssetUrl(objectPath);
    return { storage_path: url, url, type: "html_zip" };
  }

  if (isProductionLikeRuntime()) {
    throw new Error(
      "Supabase 未配置：Cloudflare / Vercel 部署须设置 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return uploadPrototypeZipLocal(project, buffer);
}
