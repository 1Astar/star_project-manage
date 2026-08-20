import { createBug, createBugAttachment } from "@/lib/db/local-store";
import { resolvePmProjectForFeedback } from "@/lib/bugs/resolve-pm";
import { resolveStudioProjectIdByToken } from "@/lib/bugs/feedback-token";
import { matchRequirementForBug } from "@/lib/bugs/match-requirement";
import { serverOpenAiCredentials } from "@/lib/studio/ai/openai-server-settings";
import { uploadStudioAssetFile } from "@/lib/studio/asset-storage";
import { isSupabaseConfigured } from "@/lib/supabase/config";

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

  const title = (input.title?.trim() || firstLineTitle(description)).slice(0, 120);

  const contextLines = [
    input.pagePath ? `【页面】${input.pagePath}` : null,
    input.pageUrl ? `【URL】${input.pageUrl}` : null,
    input.appVersion ? `【版本】${input.appVersion}` : null,
    input.userAgent ? `【UA】${input.userAgent.slice(0, 240)}` : null,
  ].filter(Boolean);

  const fullDescription = [...contextLines, "", description].filter(Boolean).join("\n").trim();

  const credentials = await serverOpenAiCredentials();
  const match = await matchRequirementForBug({
    pmProjectId: pm.id,
    title,
    description: fullDescription,
    pagePath: input.pagePath,
    credentials,
  });

  const bug = await createBug({
    project_id: pm.id,
    requirement_id: match.requirementId,
    title,
    description: fullDescription,
    repro_steps: input.pagePath ? `页面路径：${input.pagePath}` : undefined,
    severity: 3,
    bug_type: "other",
    status: "pending",
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
        const uploaded = await uploadStudioAssetFile(pm.id, file);
        const attachment = await createBugAttachment({
          project_id: pm.id,
          bug_id: bug.id,
          title: "反馈截图",
          url: uploaded.url,
          storage_path: uploaded.storagePath,
          mime_type: uploaded.mimeType,
        });
        attachmentId = attachment.id;
      }
    } catch {
      // 截图失败不阻断建单
    }
  }

  return {
    ok: true,
    bugId: bug.id,
    projectId: pm.id,
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
