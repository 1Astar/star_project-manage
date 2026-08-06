import { requireAdminSession } from "@/lib/auth/require-admin";
import { uploadStudioAssetFile } from "@/lib/studio/asset-storage";
import { createStudioAsset } from "@/lib/studio/mutations";
import { mapStudioError, studioErr, studioOk } from "@/lib/studio/route-utils";
import type { AssetType } from "@/lib/studio/types";

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  try {
    const form = await request.formData();
    const projectId = String(form.get("projectId") ?? "").trim();
    const title = String(form.get("title") ?? "").trim();
    const assetType = (String(form.get("assetType") ?? "material") as AssetType) || "material";
    const takeaway = String(form.get("takeaway") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();
    const file = form.get("file");

    if (!projectId) return studioErr("projectId 必填");
    if (!title) return studioErr("title 必填");
    if (!(file instanceof File) || file.size === 0) return studioErr("请选择文件");

    const name = file.name.toLowerCase();
    const mime = (file.type || "").toLowerCase();
    const isImage = mime.startsWith("image/");
    const isMarkdown =
      name.endsWith(".md") ||
      name.endsWith(".markdown") ||
      mime.includes("markdown") ||
      mime === "text/plain";
    if (!isImage && !isMarkdown) {
      return studioErr("仅支持图片或 Markdown（.md）文件");
    }
    if (file.size > 8 * 1024 * 1024) {
      return studioErr("文件过大（上限 8MB）");
    }

    const uploaded = await uploadStudioAssetFile(projectId, file);
    const asset = await createStudioAsset({
      title,
      projectId,
      assetType,
      url: uploaded.url,
      storagePath: uploaded.storagePath,
      mimeType: uploaded.mimeType,
      takeaway,
      note,
    });

    return studioOk({ asset }, 201);
  } catch (error) {
    return mapStudioError(error);
  }
}
