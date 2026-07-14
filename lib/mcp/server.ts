import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { captureIdea } from "@/lib/studio/capture-idea";
import { getAllIdeas, getAllProjects } from "@/lib/studio/data";
import {
  convertIdeaToProject,
  createStudioTask,
  updateStudioIdea,
  type CreateProjectInput,
} from "@/lib/studio/mutations";
import type { IdeaStatus, IdeaType, TaskPriority, TaskStatus } from "@/lib/studio/types";
import { mcpError, mcpJson } from "@/lib/mcp/response";

const ideaStatusSchema = z.enum([
  "inbox",
  "reviewing",
  "converted",
  "done",
  "parked",
  "archived",
]);
const ideaTypeSchema = z.enum(["product", "feature", "ui", "content", "tech", "business"]);
const taskStatusSchema = z.enum(["todo", "in_progress", "done", "paused"]);
const taskPrioritySchema = z.enum(["P0", "P1", "P2", "P3"]);

function slimIdea(idea: Awaited<ReturnType<typeof getAllIdeas>>[number]) {
  return {
    id: idea.id,
    title: idea.title,
    summary: idea.oneLineIdea,
    type: idea.type,
    status: idea.status,
    relatedProjectId: idea.relatedProjectId,
    createdAt: idea.createdAt,
  };
}

function slimProject(project: Awaited<ReturnType<typeof getAllProjects>>[number]) {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    priority: project.priority,
    positioning: project.positioning,
  };
}

export function registerStarPmTools(server: McpServer) {
  server.registerTool(
    "capture_idea",
    {
      title: "Capture Idea",
      description:
        "将脑暴灵感写入 Star PM 收件箱。title 必填。适合产品/功能/技术/UI/内容/商业类想法。",
      inputSchema: {
        title: z.string().min(1).describe("灵感标题"),
        rawThought: z.string().optional().describe("原始想法全文"),
        summary: z.string().optional().describe("一句话摘要"),
        why: z.string().optional().describe("为什么值得做"),
        type: z
          .string()
          .optional()
          .describe("类型：产品想法/功能想法/UI想法/技术想法/内容想法/商业想法"),
        relatedProjectId: z
          .string()
          .nullable()
          .optional()
          .describe("关联项目 ID，如 proj-star-pm"),
        emotionLevel: z.string().optional().describe("普通/喜欢/很想做"),
        suggestedNextStep: z.string().optional(),
        priority: taskPrioritySchema.optional(),
      },
    },
    async (input) => {
      try {
        const result = await captureIdea({
          title: input.title,
          rawThought: input.rawThought,
          summary: input.summary,
          why: input.why,
          type: input.type,
          source: "MCP",
          status: "inbox",
          relatedProjectId: input.relatedProjectId ?? null,
          emotionLevel: input.emotionLevel,
          suggestedNextStep: input.suggestedNextStep,
          priority: input.priority,
        });
        return mcpJson({ ok: true, message: "已进入灵感收件箱", ...result });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "capture_idea 失败");
      }
    }
  );

  server.registerTool(
    "list_ideas",
    {
      title: "List Ideas",
      description: "列出灵感收件箱或按状态/项目筛选。",
      inputSchema: {
        status: ideaStatusSchema.optional().describe("默认 inbox"),
        projectId: z.string().optional().describe("按关联项目筛选"),
        limit: z.number().int().min(1).max(100).optional().describe("默认 20"),
      },
    },
    async (input) => {
      try {
        let ideas = await getAllIdeas();
        const status = input.status ?? "inbox";
        ideas = ideas.filter((i) => i.status === status);
        if (input.projectId) {
          ideas = ideas.filter((i) => i.relatedProjectId === input.projectId);
        }
        const limit = input.limit ?? 20;
        ideas = [...ideas]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, limit);
        return mcpJson({ count: ideas.length, ideas: ideas.map(slimIdea) });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "list_ideas 失败");
      }
    }
  );

  server.registerTool(
    "list_projects",
    {
      title: "List Projects",
      description: "列出 Studio 项目，用于 capture_idea / create_task 时选择 projectId。",
      inputSchema: {
        activeOnly: z.boolean().optional().describe("默认 true，排除归档/停车场"),
      },
    },
    async (input) => {
      try {
        const projects = await getAllProjects();
        const activeOnly = input.activeOnly ?? true;
        const filtered = activeOnly
          ? projects.filter((p) => p.status !== "archived" && p.status !== "parking")
          : projects;
        return mcpJson({
          count: filtered.length,
          projects: filtered.map(slimProject),
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "list_projects 失败");
      }
    }
  );

  server.registerTool(
    "update_idea",
    {
      title: "Update Idea",
      description: "更新灵感状态、类型或关联项目。",
      inputSchema: {
        ideaId: z.string().min(1),
        title: z.string().optional(),
        status: ideaStatusSchema.optional(),
        type: ideaTypeSchema.optional(),
        relatedProjectId: z.string().nullable().optional(),
        summary: z.string().optional().describe("对应 oneLineIdea"),
        why: z.string().optional().describe("对应 whyItMatters"),
        suggestedNextStep: z.string().optional(),
        priority: taskPrioritySchema.optional(),
      },
    },
    async (input) => {
      try {
        const { ideaId, summary, why, ...rest } = input;
        const idea = await updateStudioIdea(ideaId, {
          ...rest,
          oneLineIdea: summary,
          whyItMatters: why,
          type: rest.type as IdeaType | undefined,
          status: rest.status as IdeaStatus | undefined,
        });
        return mcpJson({ ok: true, idea: slimIdea(idea) });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "update_idea 失败");
      }
    }
  );

  server.registerTool(
    "create_task",
    {
      title: "Create Task",
      description: "在指定 Studio 项目下创建任务。title 与 projectId 必填。",
      inputSchema: {
        title: z.string().min(1),
        projectId: z.string().min(1),
        status: taskStatusSchema.optional(),
        priority: taskPrioritySchema.optional(),
        dueDate: z.string().nullable().optional().describe("ISO 日期"),
        progressNote: z.string().optional(),
        sourceIdeaId: z.string().nullable().optional(),
      },
    },
    async (input) => {
      try {
        const task = await createStudioTask({
          title: input.title,
          projectId: input.projectId,
          status: input.status as TaskStatus | undefined,
          priority: input.priority as TaskPriority | undefined,
          dueDate: input.dueDate ?? null,
          progressNote: input.progressNote,
          sourceIdeaId: input.sourceIdeaId ?? null,
        });
        return mcpJson({
          ok: true,
          task: {
            id: task.id,
            title: task.title,
            projectId: task.projectId,
            status: task.status,
            priority: task.priority,
          },
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "create_task 失败");
      }
    }
  );

  server.registerTool(
    "convert_idea",
    {
      title: "Convert Idea to Project",
      description: "将灵感转为 Studio 项目，灵感状态变为 converted。",
      inputSchema: {
        ideaId: z.string().min(1),
        projectTitle: z.string().optional().describe("默认用灵感标题"),
        positioning: z.string().optional(),
      },
    },
    async (input) => {
      try {
        const projectInput: CreateProjectInput | undefined =
          input.projectTitle || input.positioning
            ? ({
                ...(input.projectTitle ? { title: input.projectTitle } : {}),
                ...(input.positioning ? { positioning: input.positioning } : {}),
              } as CreateProjectInput)
            : undefined;
        const result = await convertIdeaToProject(input.ideaId, projectInput);
        return mcpJson({
          ok: true,
          idea: slimIdea(result.idea),
          project: slimProject(result.project),
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "convert_idea 失败");
      }
    }
  );
}
