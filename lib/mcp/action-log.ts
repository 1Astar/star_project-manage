import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AiActionLogInput = {
  action: string;
  reason?: string;
  payload?: Record<string, unknown>;
  source?: string;
};

function studioId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** 写入 AI 操作日志；失败不阻断主流程 */
export async function logAiAction(input: AiActionLogInput): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const client = createServiceClient();
  if (!client) return;

  const row = {
    id: studioId("ailog-"),
    action: input.action,
    source: input.source ?? "MCP",
    reason: input.reason ?? "",
    payload: input.payload ?? {},
    created_at: new Date().toISOString(),
  };

  const { error } = await client.from("studio_ai_action_logs").insert(row);
  if (error) {
    console.warn("[star-pm mcp] ai_action_log skipped:", error.message);
  }
}
