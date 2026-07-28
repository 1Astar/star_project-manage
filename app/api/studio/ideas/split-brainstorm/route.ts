import { revalidatePath } from "next/cache";
import { getProjectById } from "@/lib/studio/data";
import { createStudioIdea, createStudioTask } from "@/lib/studio/mutations";
import {
  previewSplitBrainstorm,
  type SplitTaskDraft,
} from "@/lib/studio/split-brainstorm";
import { getPmSlugForStudioProject } from "@/lib/project-bridge";
import {
  createPoolRequirement,
  createRequirementLink,
  ensurePmProjectForStudio,
} from "@/lib/db/local-store";
import { mapStudioError, readStudioBody, studioErr, studioOk } from "@/lib/studio/route-utils";
import type { TaskPriority } from "@/lib/studio/types";

type PreviewBody = {
  mode?: "preview" | "commit";
  projectId?: string;
  text?: string;
  preferAi?: boolean;
  openAiApiKey?: string;
  openAiModel?: string;
  openAiBaseUrl?: string;
  parentTitle?: string;
  parentSummary?: string;
  /** 默认 true：同时写入需求池 */
  writePool?: boolean;
  /** 默认 true：同时写 Studio 任务 */
  writeStudioTasks?: boolean;
  tasks?: Array<{
    title: string;
    priority?: TaskPriority;
    module?: string;
    progressNote?: string;
    selected?: boolean;
  }>;
};

export async function POST(request: Request) {
  const body = await readStudioBody<PreviewBody>(request);
  if (!body?.projectId?.trim()) return studioErr("projectId 必填");
  if (!body?.text?.trim()) return studioErr("请粘贴脑暴正文");

  const project = await getProjectById(body.projectId.trim());
  if (!project) return studioErr("项目不存在", 404);

  const mode = body.mode === "commit" ? "commit" : "preview";
  const writePool = body.writePool !== false;
  const writeStudioTasks = body.writeStudioTasks !== false;

  try {
    if (mode === "preview") {
      const preview = await previewSplitBrainstorm(body.text, {
        projectTitle: project.title,
        featureModules: project.featureModules,
        preferAi: body.preferAi !== false,
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

    const selected = (body.tasks ?? []).filter(
      (t) => t.selected !== false && t.title?.trim()
    );
    if (selected.length === 0) return studioErr("请至少勾选一条任务");

    const parentTitle =
      body.parentTitle?.trim() ||
      body.text.trim().split(/\n/).find(Boolean)?.slice(0, 80) ||
      "脑暴拆条";

    const idea = await createStudioIdea({
      title: parentTitle,
      oneLineIdea: body.parentSummary?.trim() || parentTitle,
      whyItMatters: "由「粘贴脑暴拆任务」入库",
      rawInput: body.text.trim(),
      relatedProjectId: project.id,
      relatedModule: selected.find((t) => t.module?.trim())?.module?.trim() ?? "",
      status: "reviewing",
      sourceMethod: "粘贴拆任务",
      triggerSource: "手动",
      type: "product",
      priority: "P1",
    });

    const tasks = [];
    if (writeStudioTasks) {
      for (const draft of selected) {
        const noteParts = [
          draft.module?.trim() ? `板块：${draft.module.trim()}` : "",
          draft.progressNote?.trim() ?? "",
        ].filter(Boolean);
        const task = await createStudioTask({
          title: draft.module?.trim()
            ? `【${draft.module.trim()}】${draft.title.trim()}`
            : draft.title.trim(),
          projectId: project.id,
          priority: draft.priority ?? "P2",
          status: "todo",
          sourceIdeaId: idea.id,
          progressNote: noteParts.join("\n"),
        });
        tasks.push(task);
      }
    }

    const poolReqs = [];
    let poolParentId: string | null = null;
    let pmSlug: string | null = null;

    if (writePool) {
      const pmSlugResolved = getPmSlugForStudioProject(project);
      const pm = await ensurePmProjectForStudio({
        slug: pmSlugResolved,
        name: project.title,
        description: project.positioning || null,
        demo_url: project.demoUrl,
        local_run_guide: project.localRunGuide,
        code_path: project.codePath,
        repo_full_name: project.githubRepo,
        repo_branch: project.githubBranch || null,
        repo_url: project.githubRepo
          ? `https://github.com/${project.githubRepo.replace(/^https?:\/\/github\.com\//, "")}`
          : null,
      });
      pmSlug = pm.slug;

      const parentReq = await createPoolRequirement(pm.id, {
        title: parentTitle,
        type: "epic",
        priority: "P1",
        status_tags: ["想法"],
        detail_work: body.parentSummary?.trim() || body.text.trim().slice(0, 800),
        studio_idea_id: idea.id,
        inspiration_source: "粘贴脑暴拆任务",
        actor_name: "白昼",
        actor_note: "粘贴脑暴 → 需求池",
      });
      poolParentId = parentReq.id;
      poolReqs.push(parentReq);

      await createRequirementLink({
        project_id: pm.id,
        source_type: "idea",
        source_id: idea.id,
        target_type: "requirement",
        target_id: parentReq.id,
        relation_type: "from_idea",
      });

      for (const draft of selected) {
        const childTitle = draft.module?.trim()
          ? `【${draft.module.trim()}】${draft.title.trim()}`
          : draft.title.trim();
        // 子行不写 studio_idea_id：同步/去重按 idea 一对一，只挂在父 epic
        const child = await createPoolRequirement(pm.id, {
          title: childTitle,
          type: "feature",
          parent_id: parentReq.id,
          priority: draft.priority ?? "P2",
          status_tags: ["想法"],
          detail_work: draft.progressNote?.trim() || null,
          inspiration_source: "粘贴脑暴拆任务",
          sub_function: draft.module?.trim() || null,
          actor_name: "白昼",
          actor_note: "粘贴脑暴 → 需求池",
        });
        poolReqs.push(child);
        await createRequirementLink({
          project_id: pm.id,
          source_type: "idea",
          source_id: idea.id,
          target_type: "requirement",
          target_id: child.id,
          relation_type: "from_idea",
        });
      }

      revalidatePath(`/projects/${project.id}/tasks`);
      revalidatePath(`/projects/${project.id}/pool`);
      revalidatePath(`/projects/${pm.slug}/tasks`);
      revalidatePath(`/projects/${pm.slug}/pool`);
    }

    return studioOk({
      idea,
      tasks,
      poolRequirements: poolReqs,
      poolParentId,
      poolCount: Math.max(0, poolReqs.length - (poolParentId ? 1 : 0)),
      poolHref: `/projects/${project.id}/tasks`,
      pmSlug,
      count: tasks.length,
    });
  } catch (error) {
    return mapStudioError(error);
  }
}

/** 给测试/类型用 */
export type { SplitTaskDraft };
