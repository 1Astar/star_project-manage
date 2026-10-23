import { NextResponse } from "next/server";
import { resolveProjectRoute } from "@/lib/project-bridge";
import {
  deleteProjectWorkbook,
  getProjectWorkbook,
  updateProjectWorkbook,
} from "@/lib/workbooks/store";

async function assertOwned(
  routeId: string,
  workbookId: string
): Promise<{ projectId: string } | NextResponse> {
  const ctx = await resolveProjectRoute(routeId);
  const projectId = ctx.pmProject?.id;
  if (!projectId) {
    return new NextResponse("项目未接入 PM", { status: 400 });
  }
  const wb = await getProjectWorkbook(workbookId);
  if (!wb || wb.project_id !== projectId) {
    return new NextResponse("工作簿不存在", { status: 404 });
  }
  return { projectId };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; workbookId: string }> }
) {
  const { id, workbookId } = await params;
  const gate = await assertOwned(id, workbookId);
  if (gate instanceof NextResponse) return gate;
  try {
    const workbook = await getProjectWorkbook(workbookId);
    if (!workbook) return new NextResponse("工作簿不存在", { status: 404 });
    return NextResponse.json({ workbook });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "加载失败";
    return new NextResponse(msg, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; workbookId: string }> }
) {
  const { id, workbookId } = await params;
  const gate = await assertOwned(id, workbookId);
  if (gate instanceof NextResponse) return gate;
  try {
    const body = (await request.json()) as {
      title?: string;
      sheet_data?: Array<Record<string, unknown>>;
    };
    const workbook = await updateProjectWorkbook(workbookId, {
      title: body.title,
      sheet_data: body.sheet_data,
    });
    return NextResponse.json({ workbook });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "保存失败";
    return new NextResponse(msg, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; workbookId: string }> }
) {
  const { id, workbookId } = await params;
  const gate = await assertOwned(id, workbookId);
  if (gate instanceof NextResponse) return gate;
  try {
    await deleteProjectWorkbook(workbookId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "删除失败";
    return new NextResponse(msg, { status: 400 });
  }
}
