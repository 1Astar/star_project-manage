import { NextResponse } from "next/server";
import { buildWorkbookBundleTemplate } from "@/lib/excel/workbook-bundle";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const buf = await buildWorkbookBundleTemplate();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="star-pm-workbook-bundle.xlsx"',
    },
  });
}
