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
    if (!(file instanceof File) || file.size === 0) return studioErr("请选择图片文件");

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
