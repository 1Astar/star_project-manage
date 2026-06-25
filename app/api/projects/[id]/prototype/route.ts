import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { addPrototype, getProjectById } from "@/lib/db";

const UPLOAD_DIR = path.join(process.cwd(), "public", "prototypes");

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

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const dirName = `${project.slug}-${Date.now()}`;
  const dirPath = path.join(UPLOAD_DIR, dirName);
  await fs.mkdir(dirPath, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const zipPath = path.join(dirPath, "upload.zip");
  await fs.writeFile(zipPath, buffer);

  const publicPath = `/prototypes/${dirName}/upload.zip`;
  const proto = await addPrototype({
    project_id: project.id,
    name,
    type: "html_zip",
    storage_path: publicPath,
    requirement_id: typeof requirementId === "string" ? requirementId : null,
  });

  return NextResponse.json({ prototype: proto, note: "ZIP 已保存，可解压后配置 index.html 路径" });
}
