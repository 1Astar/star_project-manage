import { NextResponse } from "next/server";
import { resolveProjectRoute } from "@/lib/project-bridge";
import {
  createProjectWorkbook,
  listProjectWorkbooks,
} from "@/lib/workbooks/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  const projectId = ctx.pmProject?.id;
  if (!projectId) {
    return new NextResponse("项目未接入 PM", { status: 400 });
  }
  try {
    const workbooks = await listProjectWorkbooks(projectId);
    return NextResponse.json({
      workbooks: workbooks.map(({ sheet_data: _s, ...meta }) => meta),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "加载失败";
    return new NextResponse(msg, { status: 400 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  const projectId = ctx.pmProject?.id;
  if (!projectId) {
    return new NextResponse("项目未接入 PM", { status: 400 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
    };
    const workbook = await createProjectWorkbook({
      project_id: projectId,
      title: body.title,
    });
    return NextResponse.json({ workbook });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "创建失败";
    return new NextResponse(msg, { status: 400 });
  }
}
