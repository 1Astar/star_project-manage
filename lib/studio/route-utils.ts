import { NextResponse } from "next/server";

export function studioOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function studioErr(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
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
  const message = error instanceof Error ? error.message : "操作失败";
  const status = message.includes("不存在")
    ? 404
    : message.includes("必填") || message.includes("未配置")
      ? 400
      : 500;
  return studioErr(message, status);
}
