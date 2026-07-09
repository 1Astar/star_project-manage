import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getProjectBundle } from "@/lib/db/local-store";
import { ROLE_LABELS, TASK_STATUS_LABELS } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bundle = await getProjectBundle(id);
  if (!bundle) return new NextResponse("项目不存在", { status: 404 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(bundle.iterations[0]?.name ?? "导出");

  ws.addRow([
    "迭代",
    "需求",
    "细分功能",
    "验收标准",
    "优先级",
    "状态",
    "阻塞项",
    "岗位",
    "负责人",
    "预估工时",
    "开始时间",
    "结束时间",
  ]);

  for (const req of bundle.requirements) {
    const tasks = bundle.role_tasks.filter((t) => t.requirement_id === req.id);
    if (tasks.length === 0) {
      ws.addRow([
        bundle.iterations.find((i) => i.id === req.iteration_id)?.name ?? "",
        req.title,
        req.sub_function ?? "",
        req.acceptance_criteria ?? "",
        req.priority ?? "",
        TASK_STATUS_LABELS[req.status],
        req.blocker_reason ?? "",
        "",
        "",
        "",
        "",
        "",
      ]);
      continue;
    }
    for (const t of tasks) {
      ws.addRow([
        bundle.iterations.find((i) => i.id === req.iteration_id)?.name ?? "",
        req.title,
        req.sub_function ?? "",
        req.acceptance_criteria ?? "",
        req.priority ?? "",
        TASK_STATUS_LABELS[req.status],
        req.blocker_reason ?? "",
        ROLE_LABELS[t.role],
        t.assignee ?? "",
        t.estimate_hours ?? "",
        t.start_date ?? "",
        t.end_date ?? "",
      ]);
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = encodeURIComponent(`${bundle.project.name}-导出.xlsx`);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}
