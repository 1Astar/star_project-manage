import { NextResponse } from "next/server";
import { addPrototype, getProjectById } from "@/lib/db/local-store";
import { uploadPrototypeZip } from "@/lib/prototypes/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) return new NextResponse("项目不存在", { status: 404 });

  const formData = await request.formData();
  const externalUrl = formData.get("external_url");
  const name = String(formData.get("name") ?? "原型");
  const requirementId = formData.get("requirement_id");

  if (typeof externalUrl === "string" && externalUrl) {
    const proto = await addPrototype({
      project_id: project.id,
      name,
      type: "external_url",
      external_url: externalUrl,
      requirement_id: typeof requirementId === "string" ? requirementId : null,
    });
    return NextResponse.json({ prototype: proto });
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return new NextResponse("请上传 ZIP 或填写外链", { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadPrototypeZip(project, buffer, "upload.zip");
  const proto = await addPrototype({
    project_id: project.id,
    name,
    type: uploaded.type,
    storage_path: uploaded.storage_path,
    requirement_id: typeof requirementId === "string" ? requirementId : null,
  });

  return NextResponse.json({ prototype: proto, note: "ZIP 已保存，可解压后配置 index.html 路径" });
}
