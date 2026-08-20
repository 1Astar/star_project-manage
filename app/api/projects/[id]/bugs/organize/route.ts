import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/require-admin";
import {
  applyOrganizeBugs,
  listBugsByProject,
  listProjectRequirementOptions,
} from "@/lib/db/local-store";
import { previewOrganizeBugs } from "@/lib/bugs/organize";
import { resolvePmProject } from "@/lib/bugs/resolve-pm";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";
import type { BugType } from "@/lib/types";

type OrganizeBody = {
  mode?: "preview" | "commit";
  fillTypes?: Array<{ bugId: string; to: BugType }>;
  linkRequirements?: Array<{ bugId: string; requirementId: string }>;
  mergeGroups?: Array<{ keepId: string; closeIds: string[] }>;
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

    const body = (await readStudioBody<OrganizeBody>(request)) ?? {};
    const mode = body.mode === "commit" ? "commit" : "preview";

    const bugs = await listBugsByProject(pm.id);
    const requirements = await listProjectRequirementOptions(pm.id);
    const preview = previewOrganizeBugs({
      bugs,
      requirements: requirements.map((r) => ({ id: r.id, title: r.title })),
    });

    if (mode === "preview") {
      return studioOk({ preview });
    }

    const result = await applyOrganizeBugs(pm.id, {
      fillTypes: body.fillTypes ?? preview.fillTypes.map((r) => ({ bugId: r.bugId, to: r.to })),
      linkRequirements:
        body.linkRequirements ??
        preview.linkRequirements.map((r) => ({
          bugId: r.bugId,
          requirementId: r.requirementId,
        })),
      mergeGroups:
        body.mergeGroups ??
        preview.duplicateGroups.map((g) => ({ keepId: g.keepId, closeIds: g.closeIds })),
    });

    revalidatePath(`/projects/${ctx.routeId}/bugs`);
    revalidatePath(`/projects/${pm.slug}/bugs`);
    return studioOk({ result, preview });
  } catch (error) {
    return mapStudioError(error);
  }
}
