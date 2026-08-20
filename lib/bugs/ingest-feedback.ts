import {
  listRequirementOptionsForProject,
  upsertActivityLogRow,
  upsertBugAttachmentRow,
  upsertBugRow,
} from "@/lib/db/supabase-store";
import { resolvePmProjectForFeedback } from "@/lib/bugs/resolve-pm";
import { resolveStudioProjectIdByToken } from "@/lib/bugs/feedback-token";
import { matchRequirementForBug } from "@/lib/bugs/match-requirement";
import { serverOpenAiCredentials } from "@/lib/studio/ai/openai-server-settings";
import { uploadStudioAssetFile } from "@/lib/studio/asset-storage";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ActivityLog, Bug, BugAttachment, Project } from "@/lib/types";

export type BugFeedbackIngestInput = {
  token: string;
  title?: string;
  description: string;
  pagePath?: string;
  pageUrl?: string;
  appVersion?: string;
  userAgent?: string;
  screenshotBase64?: string;
  screenshotMimeType?: string;
  screenshotFileName?: string;
};

export type BugFeedbackIngestResult = {
  ok: true;
  bugId: string;
  projectId: string;
  studioProjectId: string;
  requirementId: string | null;
  match: {
    method: string;
    confidence: number;
    reason: string;
  };
  attachmentId?: string | null;
};

function firstLineTitle(text: string): string {
  const line =
    text
      .split(/\n/)
      .map((s) => s.trim())
      .find(Boolean) ?? "用户反馈";
  return line.replace(/^#+\s*/, "").slice(0, 80) || "用户反馈";
}

function stripDataUrl(base64: string): { mime: string | null; data: string } {
  const m = base64.match(/^data:([^;]+);base64,(.+)$/i);
  if (m) return { mime: m[1], data: m[2] };
  return { mime: null, data: base64.replace(/\s/g, "") };
}

function uid(prefix = ""): string {
  return `${prefix}${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** 不走 readDb/整库写入：公开反馈在 CF Worker 里只能用少量子请求 */
async function createBugLight(input: {
  project: Project;
  requirement_id: string | null;
  title: string;
  description: string;
  repro_steps?: string;
}): Promise<Bug> {
  const createdAt = nowIso();
  const bug: Bug = {
    id: uid("bug-"),
    project_id: input.project.id,
    requirement_id: input.requirement_id,
    title: input.title,
    description: input.description,
    repro_steps: input.repro_steps ?? null,
    assignee: null,
    status: "pending",
    severity: 3,
    bug_type: "other",
    created_at: createdAt,
    updated_at: createdAt,
  };

  if (!isSupabaseConfigured()) {
    throw new Error("公开反馈需要 Supabase");
  }

  await upsertBugRow(bug);

  const activity: ActivityLog = {
    id: uid("log-"),
    project_id: input.project.id,
    entity_type: "bug",
    entity_id: bug.id,
    field_name: "create",
    old_value: null,
    new_value: bug.title,
    actor_name: "公开反馈",
    actor_role: "admin",
    created_at: nowIso(),
  };
  try {
    await upsertActivityLogRow(activity);
  } catch {
    // 活动日志失败不阻断建单
  }

  return bug;
}

export async function ingestBugFeedback(
  input: BugFeedbackIngestInput
): Promise<BugFeedbackIngestResult> {
  const token = input.token.trim();
  if (!token) throw new Error("缺少反馈 token");

  const description = input.description.trim();
  if (!description) throw new Error("请填写反馈内容");

  const studioProjectId = await resolveStudioProjectIdByToken(token);
  if (!studioProjectId) throw new Error("无效的反馈 token");

  const { pm } = await resolvePmProjectForFeedback(studioProjectId);
  if (!pm) throw new Error(`找不到 PM 项目：${studioProjectId}`);
  const project = pm;

  const title = (input.title?.trim() || firstLineTitle(description)).slice(0, 120);

  const contextLines = [
    input.pagePath ? `【页面】${input.pagePath}` : null,
    input.pageUrl ? `【URL】${input.pageUrl}` : null,
    input.appVersion ? `【版本】${input.appVersion}` : null,
    input.userAgent ? `【UA】${input.userAgent.slice(0, 240)}` : null,
  ].filter(Boolean);

  const fullDescription = [...contextLines, "", description].filter(Boolean).join("\n").trim();

  const credentials = await serverOpenAiCredentials();
  let requirementOptions: Array<{ id: string; title: string; inPool: boolean }> = [];
  if (credentials && isSupabaseConfigured()) {
    try {
      requirementOptions = await listRequirementOptionsForProject(project.id);
    } catch {
      requirementOptions = [];
    }
  }

  const match = await matchRequirementForBug({
    pmProjectId: project.id,
    title,
    description: fullDescription,
    pagePath: input.pagePath,
    credentials,
    requirementOptions,
  });

  const bug = await createBugLight({
    project,
    requirement_id: match.requirementId,
    title,
    description: fullDescription,
    repro_steps: input.pagePath ? `页面路径：${input.pagePath}` : undefined,
  });

  let attachmentId: string | null = null;
  const rawShot = input.screenshotBase64?.trim();
  if (rawShot && isSupabaseConfigured()) {
    try {
      const { mime, data } = stripDataUrl(rawShot);
      const mimeType = input.screenshotMimeType?.trim() || mime || "image/png";
      const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
      const fileName = input.screenshotFileName?.trim() || `feedback.${ext}`;
      const buffer = Buffer.from(data, "base64");
      if (buffer.length > 0 && buffer.length <= 4 * 1024 * 1024) {
        const blob = new Blob([buffer], { type: mimeType });
        const file = new File([blob], fileName, { type: mimeType });
        const uploaded = await uploadStudioAssetFile(project.id, file);
        const attachment: BugAttachment = {
          id: uid(),
          project_id: project.id,
          bug_id: bug.id,
          title: "反馈截图",
          url: uploaded.url,
          storage_path: uploaded.storagePath,
          mime_type: uploaded.mimeType,
          created_at: nowIso(),
        };
        await upsertBugAttachmentRow(attachment);
        attachmentId = attachment.id;
      }
    } catch {
      // 截图失败不阻断建单
    }
  }

  return {
    ok: true,
    bugId: bug.id,
    projectId: project.id,
    studioProjectId,
    requirementId: match.requirementId,
    match: {
      method: match.method,
      confidence: match.confidence,
      reason: match.reason,
    },
    attachmentId,
  };
}
