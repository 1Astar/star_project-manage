import { z } from "zod";
import { applyDigestRoutes } from "@/lib/studio/apply-digest-route";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";

const routeSchema = z.object({
  ideaId: z.string().min(1),
  action: z.enum(["to_project", "to_task", "observe", "discard"]),
  targetProjectId: z.string().nullable().optional(),
});

type ApplyBody = {
  routes?: z.infer<typeof routeSchema>[];
};

export async function POST(request: Request) {
  const body = await readStudioBody<ApplyBody>(request);
  if (!body?.routes?.length) return studioErr("routes 必填且不能为空");

  const parsed = z.array(routeSchema).safeParse(body.routes);
  if (!parsed.success) return studioErr("routes 格式无效");

  try {
    const summary = await applyDigestRoutes(parsed.data);
    return studioOk(summary);
  } catch (error) {
    return mapStudioError(error);
  }
}
