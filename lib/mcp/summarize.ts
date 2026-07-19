import { z } from "zod";
import { resolveOpenAiCredentials, type OpenAiCredentials } from "@/lib/studio/ai/openai-client";
import { digestIdeasWithOpenAi } from "@/lib/studio/ai/digest-ideas";
import { isIdeaOnDate } from "@/lib/studio/idea-stream-utils";
import { getAllEvolutionLogs, getAllIdeas, getAllProjects, getProjectById } from "@/lib/studio/data";
import { getStudioSnapshot } from "@/lib/studio/store";
import { updateStudioProject } from "@/lib/studio/mutations";
import type { Project } from "@/lib/studio/types";

function envCredentials(override?: Partial<OpenAiCredentials>): OpenAiCredentials {
  return {
    apiKey: override?.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || "",
    model: override?.model?.trim() || process.env.OPENAI_MODEL?.trim() || undefined,
    baseUrl: override?.baseUrl?.trim() || process.env.OPENAI_BASE_URL?.trim() || undefined,
  };
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(payload);
}

async function chatJson(credentials: OpenAiCredentials, system: string, user: string) {
  const { apiKey, model, baseUrl } = resolveOpenAiCredentials(credentials);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI 调用失败 (${response.status}): ${detail.slice(0, 240)}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("模型未返回内容");
  return parseJsonContent(content);
}

const projectBriefSchema = z.object({
  positioning: z.string(),
  why: z.string(),
  targetUser: z.string(),
  currentStage: z.string(),
  risks: z.array(z.string()).default([]),
  nextSteps: z.array(z.string()).default([]),
});

export type ProjectBrief = z.infer<typeof projectBriefSchema>;

export async function generateProjectBrief(
  projectId: string,
  options?: { save?: boolean; credentials?: Partial<OpenAiCredentials> }
) {
  const project = await getProjectById(projectId);
  if (!project) throw new Error("项目不存在");

  const snap = await getStudioSnapshot();
  const ideas = snap.ideas.filter((i) => i.relatedProjectId === projectId).slice(0, 20);
  const tasks = snap.tasks.filter((t) => t.projectId === projectId).slice(0, 30);
  const evolutions = snap.evolutionLogs
    .filter((e) => e.projectId === projectId)
    .slice(0, 15);

  const user = [
    `项目：${project.title} (${project.id})`,
    `定位：${project.positioning || "—"}`,
    `目标用户：${project.targetUser || "—"}`,
    `阶段：${project.currentStage || "—"}`,
    `下一步：${project.nextAction || "—"}`,
    `body：${JSON.stringify(project.body)}`,
    "",
    "关联灵感：",
    ...ideas.map((i) => `- ${i.title}: ${i.oneLineIdea || i.rawInput || ""}`),
    "",
    "任务：",
    ...tasks.map((t) => `- [${t.status}] ${t.title}`),
    "",
    "演进：",
    ...evolutions.map((e) => `- ${e.title}: ${e.after || e.decision || e.reason}`),
    "",
    "请输出 JSON：positioning, why, targetUser, currentStage, risks(string[]), nextSteps(string[])",
  ].join("\n");

  const raw = await chatJson(
    envCredentials(options?.credentials),
    "你是产品经理助手，基于项目上下文生成简洁中文项目简报。只输出 JSON。",
    user
  );
  const brief = projectBriefSchema.parse(raw);

  let saved: Project | null = null;
  if (options?.save !== false) {
    const nextAction = brief.nextSteps[0] ?? project.nextAction;
    saved = await updateStudioProject(projectId, {
      positioning: brief.positioning || project.positioning,
      targetUser: brief.targetUser || project.targetUser,
      currentStage: brief.currentStage || project.currentStage,
      nextAction,
      body: {
        ...project.body,
        positioning: brief.positioning,
        whyThought: brief.why,
        nextStep: brief.nextSteps.join("\n"),
        retrospectives: [
          project.body.retrospectives,
          `【项目简报 ${new Date().toISOString().slice(0, 10)}】`,
          `风险：${brief.risks.join("；") || "—"}`,
          `下一步：${brief.nextSteps.join("；") || "—"}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
  }

  return { brief, project: saved ?? project, saved: options?.save !== false };
}

const projectSummarySchema = z.object({
  summary: z.string(),
  progress: z.string(),
  blockers: z.array(z.string()).default([]),
  nextFocus: z.string(),
});

export async function summarizeProject(
  projectId: string,
  options?: { credentials?: Partial<OpenAiCredentials> }
) {
  const project = await getProjectById(projectId);
  if (!project) throw new Error("项目不存在");
  const snap = await getStudioSnapshot();
  const ideas = snap.ideas.filter((i) => i.relatedProjectId === projectId);
  const tasks = snap.tasks.filter((t) => t.projectId === projectId);
  const done = tasks.filter((t) => t.status === "done").length;
  const evolutions = snap.evolutionLogs.filter((e) => e.projectId === projectId).slice(0, 10);

  const user = [
    `项目 ${project.title}`,
    `状态 ${project.status} 阶段 ${project.currentStage}`,
    `任务 ${done}/${tasks.length} 已完成；灵感 ${ideas.length} 条`,
    "最近演进：",
    ...evolutions.map((e) => `- ${e.createdAt.slice(0, 10)} ${e.title}`),
    "请输出 JSON：summary, progress, blockers[], nextFocus",
  ].join("\n");

  const raw = await chatJson(
    envCredentials(options?.credentials),
    "你是产品经理，用中文总结项目近况。只输出 JSON。",
    user
  );
  return {
    projectId,
    title: project.title,
    ...projectSummarySchema.parse(raw),
    stats: { ideas: ideas.length, tasks: tasks.length, tasksDone: done },
  };
}

export async function summarizeDay(
  date: string,
  options?: { credentials?: Partial<OpenAiCredentials> }
) {
  const [ideas, projects, evolutions, snap] = await Promise.all([
    getAllIdeas(),
    getAllProjects(),
    getAllEvolutionLogs(),
    getStudioSnapshot(),
  ]);
  const dayIdeas = ideas.filter((idea) => isIdeaOnDate(idea, date));
  const dateLabel = date === "today" ? "今日" : date;
  const dayKey =
    date === "today"
      ? new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date())
      : date;

  const dayEvolutions = evolutions.filter((e) => e.createdAt.slice(0, 10) === dayKey);
  const dayTasks = snap.tasks.filter((t) => {
    const stamp = t.completedAt || t.dueDate;
    return stamp ? stamp.slice(0, 10) === dayKey : false;
  });

  const digest = await digestIdeasWithOpenAi(
    { ideas: dayIdeas, projects, dateLabel },
    envCredentials(options?.credentials)
  );

  const activeProjects = [
    ...new Set(
      dayIdeas
        .map((i) => i.relatedProjectId)
        .filter((id): id is string => !!id)
        .concat(dayEvolutions.map((e) => e.projectId))
    ),
  ];

  return {
    date: dayKey,
    dateLabel,
    report: {
      newIdeas: dayIdeas.length,
      pushedProjects: activeProjects.length,
      evolutionCount: dayEvolutions.length,
      taskTouchCount: dayTasks.length,
      themes: digest.themes,
      suggestion: digest.themes[0]
        ? `优先围绕「${digest.themes[0]}」推进，并处理 digest 建议路由`
        : "今日碎片较少，可补记录或推进主线任务",
    },
    digest,
    projectIds: activeProjects,
  };
}
