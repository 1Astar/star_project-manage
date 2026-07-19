import { NextResponse } from "next/server";
import {
  isStudioDuplicateError,
  StudioDuplicateError,
} from "@/lib/studio/entity-dedupe";
import { CaptureDuplicateError } from "@/lib/studio/capture-relation";

export function studioOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function studioErr(
  message: string,
  status = 400,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function readStudioBody<T extends Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    const body = (await request.json()) as T;
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

export function mapStudioError(error: unknown) {
  if (error instanceof StudioDuplicateError || isStudioDuplicateError(error)) {
    const dup = error as StudioDuplicateError;
    return studioErr(dup.message, 409, {
      code: "DUPLICATE",
      kind: dup.kind,
      candidates: dup.candidates,
      hint: dup.hint,
    });
  }
  if (error instanceof CaptureDuplicateError) {
    return studioErr(error.message, 409, {
      code: "DUPLICATE",
      kind: "idea",
      candidates: error.candidates,
      hint: "请 update_idea 更新已有条目，或传 force:true 强制新建",
    });
  }

  const message = error instanceof Error ? error.message : "操作失败";
  const status = message.includes("不存在")
    ? 404
    : message.includes("必填") || message.includes("未配置")
      ? 400
      : 500;
  return studioErr(message, status);
}
