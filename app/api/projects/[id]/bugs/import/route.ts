import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { createPoolRequirement, importBugs } from "@/lib/db/local-store";
import {
  previewBugFeedback,
  severityToRequirementPriority,
  type FeedbackItemKind,
} from "@/lib/bugs/parse-feedback";
import { resolvePmProject } from "@/lib/bugs/resolve-pm";
import { AGENT_ACTOR_NAME } from "@/lib/cursor-actor";
import { applyLifecycleStatus } from "@/lib/requirement-status";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";
import type { BugSeverity, BugType } from "@/lib/types";

type ImportBody = {
  mode?: "preview" | "commit";
  text?: string;
  preferAi?: boolean;
  /** 已选截图文件名，供 AI 写进 imageHints */
  imageFileNames?: string[];
  openAiApiKey?: string;
  openAiModel?: string;
  openAiBaseUrl?: string;
  items?: Array<{
    title?: string;
    description?: string;
    reproSteps?: string;
    severity?: BugSeverity;
    bugType?: BugType;
    kind?: FeedbackItemKind;
    selected?: boolean;
    requirementId?: string | null;
    assignee?: string;
    createdAt?: string | null;
  }>;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminSession();
    if (auth.error) return auth.error;

    const { id } = await params;
    const { pm, ctx } = await resolvePmProject(id);
    if (!pm) return studioErr("项目不存在或未接入 PM 需求库", 404);

    const body = await readStudioBody<ImportBody>(request);
    if (!body) return studioErr("请求体无效");

    const mode = body.mode === "commit" ? "commit" : "preview";

    if (mode === "preview") {
      if (!body.text?.trim()) return studioErr("请粘贴反馈正文");
      const preview = await previewBugFeedback(body.text, {
        projectTitle: pm.name,
        preferAi: body.preferAi !== false,
        imageFileNames: body.imageFileNames,
        credentials: body.openAiApiKey
          ? {
              apiKey: body.openAiApiKey,
              model: body.openAiModel,
              baseUrl: body.openAiBaseUrl,
            }
          : null,
      });
      return studioOk({ preview });
    }

    const selected = (body.items ?? []).filter(
      (t) => t.selected !== false && t.title?.trim()
    );
    if (selected.length === 0) return studioErr("请至少勾选一条");

    const bugItems = selected.filter((t) => (t.kind ?? "bug") !== "requirement");
    const reqItems = selected.filter((t) => t.kind === "requirement");

    const createdBugs =
      bugItems.length === 0
        ? []
        : await importBugs(
            pm.id,
            bugItems.map((item) => ({
              title: item.title!.trim(),
              description: item.description?.trim() || undefined,
              repro_steps: item.reproSteps?.trim() || undefined,
              severity: item.severity,
              bug_type: item.bugType,
              assignee: item.assignee,
              requirement_id: item.requirementId ?? null,
              created_at: item.createdAt ?? null,
            }))
          );

    const createdReqs = [];
    for (const item of reqItems) {
      const detailParts = [
        item.description?.trim() || "",
        item.reproSteps?.trim() ? `说明：\n${item.reproSteps.trim()}` : "",
      ].filter(Boolean);
      const req = await createPoolRequirement(pm.id, {
        title: item.title!.trim(),
        priority: severityToRequirementPriority(item.severity ?? 3),
        type: "feature",
        status_tags: applyLifecycleStatus([], "想法"),
        detail_work: detailParts.join("\n\n") || null,
        actor_name: AGENT_ACTOR_NAME,
        actor_note: "整理反馈入库",
        inspiration_source: "整理反馈",
      });
      createdReqs.push(req);
    }

    revalidatePath(`/projects/${ctx.routeId}/bugs`);
    revalidatePath(`/projects/${pm.slug}/bugs`);
    revalidatePath(`/projects/${ctx.routeId}/tasks`);
    revalidatePath(`/projects/${pm.slug}/tasks`);

    return studioOk({
      count: createdBugs.length + createdReqs.length,
      bugCount: createdBugs.length,
      requirementCount: createdReqs.length,
      bugs: createdBugs.map((b) => ({
        id: b.id,
        title: b.title,
        severity: b.severity,
        bugType: b.bug_type,
      })),
      requirements: createdReqs.map((r) => ({
        id: r.id,
        title: r.title,
        priority: r.priority,
      })),
    });
  } catch (error) {
    return mapStudioError(error);
  }
}
