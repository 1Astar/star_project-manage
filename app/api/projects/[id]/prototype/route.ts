import { NextResponse } from "next/server";
import { addPrototype, getProjectById } from "@/lib/db/local-store";
import { uploadPrototypeFile } from "@/lib/prototypes/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const formData = await request.formData();
    const externalUrl = formData.get("external_url");
    const name = String(formData.get("name") ?? "原型").trim() || "原型";
    const requirementId = formData.get("requirement_id");

    if (typeof externalUrl === "string" && externalUrl.trim()) {
      const proto = await addPrototype({
        project_id: project.id,
        name,
        type: "external_url",
        external_url: externalUrl.trim(),
        requirement_id: typeof requirementId === "string" ? requirementId : null,
      });
      return NextResponse.json({ prototype: proto });
    }

    const file = formData.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "请选择 HTML 或 ZIP 文件，或填写外链" }, { status: 400 });
    }

    const filename = file instanceof File && file.name ? file.name : "upload.zip";
    if (!/\.(zip|html?)$/i.test(filename)) {
      return NextResponse.json({ error: "仅支持 .html 或 .zip 文件" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadPrototypeFile(project, buffer, filename);
    const proto = await addPrototype({
      project_id: project.id,
      name: name === "原型" ? filename.replace(/\.(zip|html?)$/i, "") || "原型" : name,
      type: uploaded.type,
      storage_path: uploaded.storage_path,
      requirement_id: typeof requirementId === "string" ? requirementId : null,
    });

    return NextResponse.json({
      prototype: proto,
      note: uploaded.type === "html_zip" && /\.zip$/i.test(filename)
        ? "ZIP 已保存，可解压后配置 index.html 路径"
        : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
