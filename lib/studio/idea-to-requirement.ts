import { revalidatePath } from "next/cache";
import {
  createPoolRequirement,
  createRequirementLink,
  ensurePmProjectForStudio,
} from "@/lib/db/local-store";
import { getPmSlugForStudioProject } from "@/lib/project-bridge";
import { getIdeaById, getProjectById } from "@/lib/studio/data";
import { updateStudioIdea } from "@/lib/studio/mutations";
import type { Idea } from "@/lib/studio/types";

export type IdeaToRequirementInput = {
  /** 覆盖验收；默认用灵感「下一步」或 why */
  acceptance?: string | null;
  /** 覆盖详情 */
  detail?: string | null;
  /** 写入后是否把灵感标 reviewing（默认 true） */
  markReviewing?: boolean;
};

function buildAcceptance(idea: Idea, override?: string | null): string {
  const o = override?.trim();
  if (o) return o;
  const next = idea.suggestedNextStep?.trim();
  if (next) return `下一步可验：${next}`;
  const why = idea.whyItMatters?.trim();
  if (why) return `做到可说明价值：${why}`;
  return "打开关联项目需求池，可见本条且关联原灵感。";
}

function buildDetail(idea: Idea, override?: string | null): string {
  const o = override?.trim();
  if (o) return o;
  const parts = [
    idea.oneLineIdea?.trim() || "",
    idea.rawInput?.trim() ? `原始想法：\n${idea.rawInput.trim()}` : "",
    idea.aiSupplement?.trim() ? `AI补充：\n${idea.aiSupplement.trim()}` : "",
    idea.whyItMatters?.trim() ? `为什么：${idea.whyItMatters.trim()}` : "",
  ].filter(Boolean);
  return parts.join("\n\n") || idea.title;
}

/**
 * 灵感 → 需求池一条（幂等：同 project + studio_idea_id 已存在则返回原需求）。
 * 不写 Studio 任务。
 */
export async function convertIdeaToRequirement(
  ideaId: string,
  input: IdeaToRequirementInput = {}
) {
  const idea = await getIdeaById(ideaId);
  if (!idea) throw new Error("灵感不存在");
  if (!idea.relatedProjectId?.trim()) {
    throw new Error("请先给灵感关联项目，再转需求");
  }

  const project = await getProjectById(idea.relatedProjectId);
  if (!project) throw new Error("关联项目不存在");

  const pmSlug = getPmSlugForStudioProject(project);
  const pm = await ensurePmProjectForStudio({
    slug: pmSlug,
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

  const acceptance = buildAcceptance(idea, input.acceptance);
  const detail = buildDetail(idea, input.detail);

  const req = await createPoolRequirement(pm.id, {
    title: idea.title.trim() || "未命名灵感",
    type: "feature",
    priority: idea.priority || "P2",
    status_tags: ["想法"],
    detail_work: detail,
    acceptance_criteria: acceptance,
    next_step: idea.suggestedNextStep?.trim() || null,
    studio_idea_id: idea.id,
    inspiration_source: idea.chatTopic?.trim() || idea.sourceMethod || "灵感转需求",
    sub_function: idea.relatedModule?.trim() || null,
    actor_name: "白昼",
    actor_note: idea.chatTopic?.trim() || "灵感卡片 → 需求池",
  });

  await createRequirementLink({
    project_id: pm.id,
    source_type: "idea",
    source_id: idea.id,
    target_type: "requirement",
    target_id: req.id,
    relation_type: "from_idea",
  });

  let updatedIdea = idea;
  if (input.markReviewing !== false && idea.status === "inbox") {
    updatedIdea = await updateStudioIdea(idea.id, { status: "reviewing" });
  }

  revalidatePath(`/stream`);
  revalidatePath(`/projects/${project.id}/tasks`);
  revalidatePath(`/projects/${project.id}/pool`);
  revalidatePath(`/projects/${pm.slug}/tasks`);
  revalidatePath(`/projects/${pm.slug}/pool`);

  return {
    requirement: req,
    idea: updatedIdea,
    projectId: project.id,
    pmSlug: pm.slug,
    poolHref: `/projects/${project.id}/tasks`,
    created: true,
  };
}
