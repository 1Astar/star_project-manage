import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { importBugs } from "@/lib/db/local-store";
import { previewBugFeedback } from "@/lib/bugs/parse-feedback";
import { resolvePmProject } from "@/lib/bugs/resolve-pm";
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
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const { id } = await params;
  const { pm, ctx } = await resolvePmProject(id);
  if (!pm) return studioErr("项目不存在或未接入 PM 需求库", 404);

  const body = await readStudioBody<ImportBody>(request);
  if (!body) return studioErr("请求体无效");

  const mode = body.mode === "commit" ? "commit" : "preview";

  try {
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
    if (selected.length === 0) return studioErr("请至少勾选一条 Bug");

    const created = await importBugs(
      pm.id,
      selected.map((item) => ({
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

    revalidatePath(`/projects/${ctx.routeId}/bugs`);
    revalidatePath(`/projects/${pm.slug}/bugs`);

    return studioOk({
      count: created.length,
      bugs: created.map((b) => ({
        id: b.id,
        title: b.title,
        severity: b.severity,
        bugType: b.bug_type,
      })),
    });
  } catch (error) {
    return mapStudioError(error);
  }
}
