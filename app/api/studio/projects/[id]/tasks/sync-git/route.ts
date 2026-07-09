import { syncProjectTasksFromGit } from "@/lib/studio/task-git";
import { getProjectById } from "@/lib/studio/data";
import { mapStudioError, studioErr, studioOk } from "@/lib/studio/route-utils";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const project = await getProjectById(id);
  if (!project) return studioErr("项目不存在", 404);

  try {
    const result = await syncProjectTasksFromGit(project);
    return studioOk(result);
  } catch (error) {
    return mapStudioError(error);
  }
}
