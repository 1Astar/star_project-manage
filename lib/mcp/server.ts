import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { captureIdea } from "@/lib/studio/capture-idea";
import { CaptureDuplicateError } from "@/lib/studio/capture-relation";
import { getAllIdeas, getAllProjects, getProjectById } from "@/lib/studio/data";
import {
  convertIdeaToProject,
  createStudioTask,
  updateStudioIdea,
  type CreateProjectInput,
} from "@/lib/studio/mutations";
import type { IdeaStatus, IdeaType, TaskPriority, TaskStatus } from "@/lib/studio/types";
import { formatIdeaMemory, searchIdeas } from "@/lib/mcp/idea-memory";
import { mcpError, mcpJson } from "@/lib/mcp/response";
import {
  DDL_COLUMN_TYPES,
  addColumn,
  createStudioIndex,
  createStudioTable,
  describeStudioTable,
  listStudioTables,
} from "@/lib/mcp/schema-tools";
import { registerWorkspaceTools } from "@/lib/mcp/workspace-tools";
import { logAiAction } from "@/lib/mcp/action-log";

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
const ddlTypeSchema = z.enum(DDL_COLUMN_TYPES);

function slimIdea(idea: Awaited<ReturnType<typeof getAllIdeas>>[number]) {
  return {
    id: idea.id,
    title: idea.title,
    summary: idea.oneLineIdea,
    aiSupplement: idea.aiSupplement || null,
    chatTopic: idea.chatTopic || null,
    type: idea.type,
    status: idea.status,
    relatedProjectId: idea.relatedProjectId,
    relatedModule: idea.relatedModule || null,
    parentIdeaId: idea.relatedIdeaId,
    sourceChat: idea.sourceChat || null,
    sourceMethod: idea.sourceMethod || idea.triggerSource || null,
    occurredAt: idea.occurredAt,
    completedAt: idea.completedAt,
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
  registerWorkspaceTools(server);

  server.registerTool(
    "capture_idea",
    {
      title: "Capture Idea",
      description:
        "将脑暴灵感写入 Star PM 收件箱。强烈建议填写 relatedModule（功能板块），便于发版按板块追溯。入库前会标题查重；未指定 relatedIdeaId 时尝试自动挂父 Idea。疑似重复时拒绝写入（可 force:true）。",
      inputSchema: {
        title: z.string().min(1).describe("灵感标题"),
        rawThought: z.string().optional().describe("原始想法全文"),
        summary: z.string().optional().describe("一句话摘要"),
        aiSupplement: z.string().optional().describe("AI 补充"),
        chatTopic: z.string().optional().describe("聊天主题"),
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
        relatedIdeaId: z.string().nullable().optional().describe("父 Idea ID；缺省时可能自动推断"),
        relatedModule: z
          .string()
          .optional()
          .describe("功能板块（强烈建议）：工作台/项目库/灵感/需求任务/迭代记录/资源中心/Git/设置 等"),
        sourceChat: z.string().optional().describe("来源聊天"),
        sourceMethod: z.string().optional().describe("来源方式：ChatGPT/手动/GitHub/Notion"),
        decisionNotes: z.string().optional().describe("决策记录"),
        evolutionNotes: z.string().optional().describe("演进记录"),
        relatedAssetsNote: z.string().optional().describe("相关资产备注"),
        emotionLevel: z.string().optional().describe("普通/喜欢/很想做"),
        suggestedNextStep: z.string().optional(),
        priority: taskPrioritySchema.optional(),
        status: z.string().optional().describe("灵感池/验证中/开发中/已完成/停车场 或 inbox 等"),
        occurredAt: z
          .string()
          .optional()
          .describe("灵感发生时间 ISO，缺省为入库当前时间"),
        force: z
          .boolean()
          .optional()
          .describe("true=跳过查重强制新建；默认 false，疑似重复则拒绝"),
        skipParentAuto: z
          .boolean()
          .optional()
          .describe("true=不要自动挂父 Idea；默认会尝试推断"),
      },
    },
    async (input) => {
      try {
        const result = await captureIdea({
          title: input.title,
          rawThought: input.rawThought,
          summary: input.summary,
          aiSupplement: input.aiSupplement,
          chatTopic: input.chatTopic,
          why: input.why,
          type: input.type,
          source: input.sourceMethod ?? "MCP",
          sourceChat: input.sourceChat,
          sourceMethod: input.sourceMethod ?? "MCP",
          status: input.status ?? "inbox",
          relatedProjectId: input.relatedProjectId ?? null,
          relatedIdeaId: input.relatedIdeaId ?? null,
          relatedModule: input.relatedModule,
          emotionLevel: input.emotionLevel,
          suggestedNextStep: input.suggestedNextStep,
          decisionNotes: input.decisionNotes,
          evolutionNotes: input.evolutionNotes,
          relatedAssetsNote: input.relatedAssetsNote,
          priority: input.priority,
          occurredAt: input.occurredAt,
          force: input.force,
          skipParentAuto: input.skipParentAuto,
        });
        await logAiAction({
          action: "capture_idea",
          payload: {
            ideaId: result.ideaId,
            title: result.title,
            parentAutoLinked: result.parentAutoLinked,
            relatedIdeaId: result.relatedIdeaId,
            duplicateSkipped: result.duplicateSkipped,
          },
        });
        return mcpJson({
          ok: true,
          message: result.parentAutoLinked
            ? `已进入灵感收件箱，并自动挂父：${result.parentLinkReason}`
            : "已进入灵感收件箱",
          warning: result.pendingModuleFill
            ? "已标记【待补齐·板块】（已关联项目但未填且未能推断 relatedModule），仍已入库。"
            : undefined,
          ...result,
        });
      } catch (error) {
        if (error instanceof CaptureDuplicateError) {
          return mcpJson({
            ok: false,
            code: "DUPLICATE",
            message: error.message,
            candidates: error.candidates,
            hint: "请 update_idea 更新已有条目，或 force:true 强制新建",
          });
        }
        return mcpError(error instanceof Error ? error.message : "capture_idea 失败");
      }
    }
  );

  server.registerTool(
    "search",
    {
      title: "Search Ideas",
      description:
        "搜索灵感记忆库。例如 search(\"AI共读\")，返回标题/内容/来源/时间/关联项目/状态。",
      inputSchema: {
        query: z.string().min(1).describe("关键词"),
        limit: z.number().int().min(1).max(50).optional().describe("默认 10"),
      },
    },
    async (input) => {
      try {
        const [ideas, projects] = await Promise.all([getAllIdeas(), getAllProjects()]);
        const projectTitle = new Map(projects.map((p) => [p.id, p.title]));
        const hits = searchIdeas(ideas, input.query, input.limit ?? 10);
        return mcpJson({
          count: hits.length,
          results: hits.map((idea) =>
            formatIdeaMemory(
              idea,
              idea.relatedProjectId ? projectTitle.get(idea.relatedProjectId) : null
            )
          ),
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "search 失败");
      }
    }
  );

  server.registerTool(
    "get_idea",
    {
      title: "Get Idea",
      description: "按 ID 获取灵感完整记忆字段。",
      inputSchema: {
        ideaId: z.string().min(1),
      },
    },
    async (input) => {
      try {
        const ideas = await getAllIdeas();
        const idea = ideas.find((i) => i.id === input.ideaId);
        if (!idea) return mcpError("灵感不存在");
        const project = idea.relatedProjectId
          ? await getProjectById(idea.relatedProjectId)
          : null;
        return mcpJson({ ok: true, idea: formatIdeaMemory(idea, project?.title) });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "get_idea 失败");
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
      description: "更新灵感状态、类型、关联、来源或沉淀备注等记忆字段。",
      inputSchema: {
        ideaId: z.string().min(1),
        title: z.string().optional(),
        status: ideaStatusSchema.optional(),
        type: ideaTypeSchema.optional(),
        relatedProjectId: z.string().nullable().optional(),
        relatedIdeaId: z.string().nullable().optional(),
        relatedModule: z.string().optional(),
        summary: z.string().optional().describe("对应 oneLineIdea"),
        why: z.string().optional().describe("对应 whyItMatters"),
        aiSupplement: z.string().optional(),
        chatTopic: z.string().optional(),
        rawInput: z.string().optional(),
        sourceChat: z.string().optional(),
        sourceMethod: z.string().optional(),
        decisionNotes: z.string().optional(),
        evolutionNotes: z.string().optional(),
        relatedAssetsNote: z.string().optional(),
        suggestedNextStep: z.string().optional(),
        priority: taskPrioritySchema.optional(),
        occurredAt: z.string().nullable().optional().describe("灵感发生时间 ISO"),
        completedAt: z.string().nullable().optional().describe("实际完成时间 ISO"),
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
          occurredAt: rest.occurredAt,
          completedAt: rest.completedAt,
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

  server.registerTool(
    "list_tables",
    {
      title: "List Studio Tables",
      description: "列出 public 下 studio_* 表，用于改库前确认。",
      inputSchema: {},
    },
    async () => {
      try {
        return mcpJson(await listStudioTables());
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "list_tables 失败");
      }
    }
  );

  server.registerTool(
    "describe_table",
    {
      title: "Describe Table",
      description: "查看 studio_* 表字段：列名/类型/可空/默认值。",
      inputSchema: {
        table: z.string().min(1).describe("如 studio_ideas"),
      },
    },
    async (input) => {
      try {
        return mcpJson(await describeStudioTable(input.table));
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "describe_table 失败");
      }
    }
  );

  server.registerTool(
    "add_column",
    {
      title: "Add Column",
      description:
        "给 studio_* 表 ADD COLUMN IF NOT EXISTS。写操作必须 confirm:true。stdio 本地会同步写 migration 文件；远程 MCP 只改库。",
      inputSchema: {
        table: z.string().min(1),
        column: z.string().min(1),
        type: ddlTypeSchema,
        nullable: z.boolean().optional().describe("默认 true；false 时会补安全默认值"),
        defaultSql: z
          .string()
          .nullable()
          .optional()
          .describe("如 now() / true / '' / '[]'::jsonb"),
        confirm: z.boolean().describe("必须为 true 才执行"),
      },
    },
    async (input) => {
      try {
        return mcpJson(
          await addColumn({
            table: input.table,
            column: input.column,
            type: input.type,
            nullable: input.nullable,
            defaultSql: input.defaultSql,
            confirm: input.confirm,
          })
        );
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "add_column 失败");
      }
    }
  );

  server.registerTool(
    "create_table",
    {
      title: "Create Table",
      description: "CREATE TABLE IF NOT EXISTS studio_*。confirm:true 才执行。",
      inputSchema: {
        table: z.string().min(1).describe("必须 studio_ 前缀"),
        columns: z
          .array(
            z.object({
              name: z.string().min(1),
              type: ddlTypeSchema,
              primaryKey: z.boolean().optional(),
              nullable: z.boolean().optional(),
              defaultSql: z.string().nullable().optional(),
              references: z.string().nullable().optional().describe("引用的 studio_* 表"),
            })
          )
          .min(1),
        confirm: z.boolean(),
      },
    },
    async (input) => {
      try {
        return mcpJson(
          await createStudioTable({
            table: input.table,
            columns: input.columns,
            confirm: input.confirm,
          })
        );
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "create_table 失败");
      }
    }
  );

  server.registerTool(
    "create_index",
    {
      title: "Create Index",
      description: "CREATE INDEX IF NOT EXISTS on studio_*。confirm:true 才执行。",
      inputSchema: {
        table: z.string().min(1),
        columns: z.array(z.string().min(1)).min(1),
        name: z.string().optional(),
        unique: z.boolean().optional(),
        confirm: z.boolean(),
      },
    },
    async (input) => {
      try {
        return mcpJson(
          await createStudioIndex({
            table: input.table,
            columns: input.columns,
            name: input.name,
            unique: input.unique,
            confirm: input.confirm,
          })
        );
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "create_index 失败");
      }
    }
  );
}
