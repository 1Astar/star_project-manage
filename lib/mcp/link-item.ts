import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  updateStudioIdea,
  updateStudioTask,
  updateStudioAsset,
} from "@/lib/studio/mutations";
import { getStudioSnapshot } from "@/lib/studio/store";

export type LinkEntityType = "idea" | "project" | "task" | "asset" | "module";

export type LinkItemInput = {
  sourceType: LinkEntityType;
  sourceId: string;
  targetType: LinkEntityType;
  targetId: string;
  relationType?: string;
  note?: string;
};

function linkId() {
  return `link-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function assertExists(
  type: LinkEntityType,
  id: string
): Promise<void> {
  if (type === "module") {
    if (!id.trim()) throw new Error("module 名称不能为空");
    return;
  }
  const snap = await getStudioSnapshot();
  if (type === "idea" && !snap.ideas.some((i) => i.id === id)) {
    throw new Error(`灵感不存在：${id}`);
  }
  if (type === "project" && !snap.projects.some((p) => p.id === id)) {
    throw new Error(`项目不存在：${id}`);
  }
  if (type === "task" && !snap.tasks.some((t) => t.id === id)) {
    throw new Error(`任务不存在：${id}`);
  }
  if (type === "asset" && !snap.assets.some((a) => a.id === id)) {
    throw new Error(`资产不存在：${id}`);
  }
}

/** 同步常用外键，便于列表页直接展示 */
async function syncConvenienceFk(input: LinkItemInput): Promise<string[]> {
  const applied: string[] = [];
  const relation = input.relationType ?? "related";

  if (input.sourceType === "idea" && input.targetType === "project") {
    await updateStudioIdea(input.sourceId, { relatedProjectId: input.targetId });
    applied.push("idea.relatedProjectId");
  }
  if (input.sourceType === "idea" && input.targetType === "idea") {
    await updateStudioIdea(input.sourceId, { relatedIdeaId: input.targetId });
    applied.push("idea.relatedIdeaId");
  }
  if (input.sourceType === "idea" && input.targetType === "module") {
    await updateStudioIdea(input.sourceId, { relatedModule: input.targetId });
    applied.push("idea.relatedModule");
  }
  if (input.sourceType === "task" && input.targetType === "idea") {
    await updateStudioTask(input.sourceId, { sourceIdeaId: input.targetId });
    applied.push("task.sourceIdeaId");
  }
  if (input.sourceType === "task" && input.targetType === "project") {
    await updateStudioTask(input.sourceId, { projectId: input.targetId });
    applied.push("task.projectId");
  }
  if (input.sourceType === "asset" && input.targetType === "project") {
    await updateStudioAsset(input.sourceId, { projectId: input.targetId });
    applied.push("asset.projectId");
  }
  if (input.sourceType === "project" && input.targetType === "idea" && relation === "related") {
    await updateStudioIdea(input.targetId, { relatedProjectId: input.sourceId });
    applied.push("idea.relatedProjectId←project");
  }

  return applied;
}

export async function linkItem(input: LinkItemInput) {
  await assertExists(input.sourceType, input.sourceId);
  await assertExists(input.targetType, input.targetId);

  const relationType = (input.relationType ?? "related").trim() || "related";
  const note = input.note?.trim() ?? "";
  const synced = await syncConvenienceFk({ ...input, relationType });

  const row = {
    id: linkId(),
    source_type: input.sourceType,
    source_id: input.sourceId,
    target_type: input.targetType,
    target_id: input.targetId,
    relation_type: relationType,
    note,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const client = createServiceClient();
    if (!client) throw new Error("Supabase 未配置");
    const { error } = await client.from("studio_links").insert(row);
    if (error) {
      const msg = error.message.toLowerCase();
      if (!msg.includes("duplicate") && !msg.includes("unique")) {
        throw new Error(error.message);
      }
    }
  }

  return {
    ok: true as const,
    link: {
      id: row.id,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      targetType: input.targetType,
      targetId: input.targetId,
      relationType,
      note,
    },
    syncedFields: synced,
  };
}
