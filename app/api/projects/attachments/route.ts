import { requireAdminSession } from "@/lib/auth/require-admin";
import { createRequirementAttachment, deleteRequirementAttachment } from "@/lib/db/local-store";
import { uploadStudioAssetFile } from "@/lib/studio/asset-storage";
import { mapStudioError, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  try {
    const form = await request.formData();
    const projectId = String(form.get("projectId") ?? "").trim();
    const requirementId = String(form.get("requirementId") ?? "").trim();
    const title = String(form.get("title") ?? "").trim();
    const file = form.get("file");

    if (!projectId) return studioErr("projectId 必填");
    if (!requirementId) return studioErr("requirementId 必填");
    if (!(file instanceof File) || file.size === 0) return studioErr("请选择图片文件");

    const uploaded = await uploadStudioAssetFile(projectId, file);
    const attachment = await createRequirementAttachment({
      project_id: projectId,
      requirement_id: requirementId,
      title: title || file.name || "需求附图",
      url: uploaded.url,
      storage_path: uploaded.storagePath,
      mime_type: uploaded.mimeType,
    });

    return studioOk({ attachment }, 201);
  } catch (error) {
    return mapStudioError(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();
    if (!id) return studioErr("id 必填");
    await deleteRequirementAttachment(id);
    return studioOk({ ok: true });
  } catch (error) {
    return mapStudioError(error);
  }
}
