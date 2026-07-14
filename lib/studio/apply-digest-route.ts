import {
  convertIdeaToProject,
  createStudioTask,
  updateStudioIdea,
  type UpdateIdeaInput,
} from "@/lib/studio/mutations";
import { getStudioSnapshot } from "@/lib/studio/store";

export type DigestRouteAction = "to_project" | "to_task" | "observe" | "discard";

export type DigestRouteInput = {
  ideaId: string;
  action: DigestRouteAction;
  targetProjectId?: string | null;
};

export type DigestRouteResult = {
  ideaId: string;
  action: DigestRouteAction;
  ok: boolean;
  error?: string;
  projectId?: string;
  taskId?: string;
};

function fail(
  route: DigestRouteInput,
  error: string
): DigestRouteResult {
  return {
    ideaId: route.ideaId,
    action: route.action,
    ok: false,
    error,
  };
}

async function ensureProjectExists(projectId: string): Promise<boolean> {
  const snapshot = await getStudioSnapshot();
  return snapshot.projects.some((p) => p.id === projectId);
}

export async function applyDigestRoute(route: DigestRouteInput): Promise<DigestRouteResult> {
  const snapshot = await getStudioSnapshot();
  const idea = snapshot.ideas.find((item) => item.id === route.ideaId);
  if (!idea) return fail(route, "灵感不存在");

  if (idea.status === "archived" || idea.status === "converted" || idea.status === "done") {
    const label =
      idea.status === "converted" ? "转项目" : idea.status === "done" ? "完成" : "归档";
    return fail(route, `灵感已${label}，跳过`);
  }

  switch (route.action) {
    case "to_project": {
      if (route.targetProjectId) {
        if (!(await ensureProjectExists(route.targetProjectId))) {
          return fail(route, "目标项目不存在");
        }
        await updateStudioIdea(route.ideaId, {
          relatedProjectId: route.targetProjectId,
          status: "reviewing",
        });
        return {
          ideaId: route.ideaId,
          action: route.action,
          ok: true,
          projectId: route.targetProjectId,
        };
      }

      const result = await convertIdeaToProject(route.ideaId);
      return {
        ideaId: route.ideaId,
        action: route.action,
        ok: true,
        projectId: result.project.id,
      };
    }

    case "to_task": {
      const projectId = route.targetProjectId ?? idea.relatedProjectId;
      if (!projectId) return fail(route, "转任务需要目标项目");
      if (!(await ensureProjectExists(projectId))) {
        return fail(route, "目标项目不存在");
      }

      const task = await createStudioTask({
        title: idea.title,
        projectId,
        sourceIdeaId: idea.id,
        progressNote: idea.oneLineIdea || idea.whyItMatters || idea.rawInput || "",
      });
      await updateStudioIdea(route.ideaId, {
        relatedProjectId: projectId,
        status: "reviewing",
      });
      return {
        ideaId: route.ideaId,
        action: route.action,
        ok: true,
        projectId,
        taskId: task.id,
      };
    }

    case "observe": {
      const patch: UpdateIdeaInput = { status: "reviewing" };
      if (route.targetProjectId) {
        if (!(await ensureProjectExists(route.targetProjectId))) {
          return fail(route, "目标项目不存在");
        }
        patch.relatedProjectId = route.targetProjectId;
      }
      await updateStudioIdea(route.ideaId, patch);
      return {
        ideaId: route.ideaId,
        action: route.action,
        ok: true,
        projectId: route.targetProjectId ?? idea.relatedProjectId ?? undefined,
      };
    }

    case "discard": {
      await updateStudioIdea(route.ideaId, { status: "archived" });
      return {
        ideaId: route.ideaId,
        action: route.action,
        ok: true,
      };
    }

    default:
      return fail(route, "未知操作");
  }
}

export async function applyDigestRoutes(routes: DigestRouteInput[]): Promise<{
  results: DigestRouteResult[];
  applied: number;
  failed: number;
}> {
  const results: DigestRouteResult[] = [];
  for (const route of routes) {
    results.push(await applyDigestRoute(route));
  }
  const applied = results.filter((r) => r.ok).length;
  return { results, applied, failed: results.length - applied };
}
