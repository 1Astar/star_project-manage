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

export function humanizeDbError(message: string): string {
  if (/feature_modules/i.test(message) && /schema cache|column/i.test(message)) {
    return "数据库缺少 feature_modules 列。请在 Supabase SQL Editor 执行迁移 028_evolution_modules.sql 后重试。";
  }
  if (/release_tag|studio_evolution_logs.*module/i.test(message) && /schema cache|column/i.test(message)) {
    return "数据库缺少演进 module/release_tag 列。请执行迁移 028_evolution_modules.sql 后重试。";
  }
  if (/related_module/i.test(message) && /schema cache|column/i.test(message)) {
    return "数据库缺少 inspirations related_module 列。请在 studio_ideas 上补 related_module 后重试。";
  }
  if (/Could not find the '.*' column/i.test(message) && /schema cache/i.test(message)) {
    return `数据库缺列（${message}）。请核对并执行对应 Supabase migration 后，在 Dashboard 刷新 Schema Cache。`;
  }
  return message;
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

  const raw = error instanceof Error ? error.message : "操作失败";
  const message = humanizeDbError(raw);
  const status = message.includes("不存在")
    ? 404
    : message.includes("必填") || message.includes("未配置") || message.includes("缺少")
      ? 400
      : /migration|缺列|schema cache/i.test(message)
        ? 503
        : 500;
  return studioErr(message, status);
}
