import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAllEvolutionLogs, getProjectById, getProjectAssets, getProjectIdeas, getProjectTasks } from "@/lib/studio/data";
import {
  createStudioAsset,
  createStudioEvolution,
  createStudioProject,
  updateStudioIdea,
  updateStudioProject,
} from "@/lib/studio/mutations";
import type {
  AssetType,
  EvolutionLogType,
  ProjectPriority,
  ProjectStatus,
} from "@/lib/studio/types";
import { logAiAction } from "@/lib/mcp/action-log";
import { linkItem } from "@/lib/mcp/link-item";
import { mcpError, mcpJson } from "@/lib/mcp/response";
import {
  generateProjectBrief,
  summarizeDay,
  summarizeProject,
} from "@/lib/mcp/summarize";
import { StudioDuplicateError } from "@/lib/studio/entity-dedupe";

const projectStatusSchema = z.enum(["mainline", "active", "demo", "parking", "archived"]);
const projectPrioritySchema = z.enum(["P0", "P1", "P2", "P3"]);
const evolutionTypeSchema = z.enum([
  "initial",
  "positioning",
  "feature_add",
  "feature_cut",
  "tech_decision",
  "ui_change",
  "stage_review",
]);
const assetTypeSchema = z.enum([
  "experience",
  "repo",
  "design",
  "doc",
  "material",
  "prompt",
  "api",
  "deploy",
  "video",
  "competitor",
  "ui_ref",
  "tech_doc",
  "inspiration",
]);
const linkEntitySchema = z.enum(["idea", "project", "task", "asset", "module"]);

function slimProject(project: NonNullable<Awaited<ReturnType<typeof getProjectById>>>) {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    priority: project.priority,
    positioning: project.positioning,
    targetUser: project.targetUser,
    currentStage: project.currentStage,
    nextAction: project.nextAction,
    updatedAt: project.updatedAt,
  };
}

export function registerWorkspaceTools(server: McpServer) {
  server.registerTool(
    "get_ai_rules",
    {
      title: "Get AI Rules",
      description:
        "读取 Star PM 统一 AI 规则正文（docs/ai/CANONICAL_RULES.md）。大批量写入/改代码前应先调用。",
      inputSchema: {},
    },
    async () => {
      try {
        const { loadCanonicalAiRules } = await import("@/lib/studio/compare-sources");
        const rules = await loadCanonicalAiRules();
        await logAiAction({ action: "get_ai_rules", payload: { path: rules.path } });
        return mcpJson({
          ok: true,
          path: rules.path,
          content: rules.content,
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "get_ai_rules 失败");
      }
    }
  );

  server.registerTool(
    "compare_sources",
    {
      title: "Compare Sources",
      description:
        "对比项目 Git / Vercel production / Studio 同步记录，判断谁最新，避免用旧版本覆盖。改代码前建议调用。",
      inputSchema: {
        projectId: z.string().min(1),
      },
    },
    async (input) => {
      try {
        const { compareProjectSources } = await import("@/lib/studio/compare-sources");
        const result = await compareProjectSources(input.projectId);
        await logAiAction({
          action: "compare_sources",
          payload: { projectId: input.projectId, newest: result.newest, diverged: result.diverged },
        });
        return mcpJson({ ok: true, ...result });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "compare_sources 失败");
      }
    }
  );

  server.registerTool(
    "get_project",
    {
      title: "Get Project",
      description: "按 ID 获取项目详情，含关联灵感/任务/演进/资产摘要。",
      inputSchema: {
        projectId: z.string().min(1),
        includeRelated: z.boolean().optional().describe("默认 true"),
      },
    },
    async (input) => {
      try {
        const project = await getProjectById(input.projectId);
        if (!project) return mcpError("项目不存在");
        const include = input.includeRelated ?? true;
        if (!include) return mcpJson({ ok: true, project: slimProject(project), body: project.body });

        const [ideas, tasks, assets, evolutions] = await Promise.all([
          getProjectIdeas(project.id),
          getProjectTasks(project.id),
          getProjectAssets(project.id),
          getAllEvolutionLogs(),
        ]);
        const projectEvo = evolutions
          .filter((e) => e.projectId === project.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 10);

        await logAiAction({
          action: "get_project",
          payload: { projectId: project.id },
        });

        return mcpJson({
          ok: true,
          project: slimProject(project),
          body: project.body,
          related: {
            ideas: ideas.slice(0, 20).map((i) => ({
              id: i.id,
              title: i.title,
              status: i.status,
              summary: i.oneLineIdea,
            })),
            tasks: tasks.slice(0, 30).map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
            })),
            assets: assets.slice(0, 20).map((a) => ({
              id: a.id,
              title: a.title,
              assetType: a.assetType,
              url: a.url,
            })),
            evolutions: projectEvo.map((e) => ({
              id: e.id,
              title: e.title,
              logType: e.logType,
              decision: e.decision,
              createdAt: e.createdAt,
            })),
          },
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "get_project 失败");
      }
    }
  );

  server.registerTool(
    "create_project",
    {
      title: "Create Project",
      description:
        "创建 Studio 项目。标题会与活跃项目查重；疑似重复时拒绝（可 force:true）。可选 sourceIdeaId：创建后把灵感关联到项目并记一条「项目诞生」演进。",
      inputSchema: {
        title: z.string().min(1),
        positioning: z.string().optional(),
        targetUser: z.string().optional(),
        status: projectStatusSchema.optional(),
        priority: projectPrioritySchema.optional(),
        currentStage: z.string().optional(),
        nextAction: z.string().optional(),
        sourceIdeaId: z.string().optional().describe("初始 Idea ID"),
        initialThought: z.string().optional(),
        force: z
          .boolean()
          .optional()
          .describe("true=跳过标题查重强制新建；默认 false"),
      },
    },
    async (input) => {
      try {
        const project = await createStudioProject({
          title: input.title,
          positioning: input.positioning,
          targetUser: input.targetUser,
          status: (input.status as ProjectStatus | undefined) ?? "active",
          priority: input.priority as ProjectPriority | undefined,
          currentStage: input.currentStage ?? "起步",
          nextAction: input.nextAction,
          force: input.force,
          body: input.initialThought
            ? { initialThought: input.initialThought }
            : undefined,
        });

        if (input.sourceIdeaId) {
          await updateStudioIdea(input.sourceIdeaId, {
            relatedProjectId: project.id,
            status: "converted",
          });
          await createStudioEvolution({
            title: "项目诞生",
            projectId: project.id,
            logType: "initial",
            after: `由灵感 ${input.sourceIdeaId} 创建项目「${project.title}」`,
            reason: "Idea 成熟转为项目",
          });
        }

        await logAiAction({
          action: "create_project",
          reason: input.sourceIdeaId ? `from idea ${input.sourceIdeaId}` : "",
          payload: { projectId: project.id, sourceIdeaId: input.sourceIdeaId ?? null },
        });

        return mcpJson({ ok: true, project: slimProject(project) });
      } catch (error) {
        if (error instanceof StudioDuplicateError) {
          return mcpJson({
            ok: false,
            code: "DUPLICATE",
            kind: error.kind,
            message: error.message,
            candidates: error.candidates,
            hint: error.hint,
          });
        }
        return mcpError(error instanceof Error ? error.message : "create_project 失败");
      }
    }
  );

  server.registerTool(
    "update_project",
    {
      title: "Update Project",
      description: "更新项目状态、阶段、下一步、定位等。",
      inputSchema: {
        projectId: z.string().min(1),
        title: z.string().optional(),
        positioning: z.string().optional(),
        targetUser: z.string().optional(),
        status: projectStatusSchema.optional(),
        priority: projectPrioritySchema.optional(),
        currentStage: z.string().optional().describe("如 V0.5 / 进行中阶段描述"),
        nextAction: z.string().optional().describe("最近进展或下一步"),
        portfolioValue: z.string().optional(),
        demoUrl: z.string().nullable().optional(),
        githubRepo: z.string().nullable().optional(),
      },
    },
    async (input) => {
      try {
        const { projectId, ...patch } = input;
        const project = await updateStudioProject(projectId, {
          ...patch,
          status: patch.status as ProjectStatus | undefined,
          priority: patch.priority as ProjectPriority | undefined,
        });
        await logAiAction({
          action: "update_project",
          payload: { projectId, patch },
        });
        return mcpJson({ ok: true, project: slimProject(project) });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "update_project 失败");
      }
    }
  );

  server.registerTool(
    "create_asset",
    {
      title: "Create Asset",
      description:
        "为项目登记资料/素材（UI、文档、竞品等）。同项目内按标题/URL 查重；疑似重复时拒绝（可 force:true）。",
      inputSchema: {
        title: z.string().min(1),
        projectId: z.string().min(1),
        assetType: assetTypeSchema.optional(),
        url: z.string().optional(),
        note: z.string().optional().describe("用途说明"),
        takeaway: z.string().optional(),
        risk: z.string().nullable().optional(),
        force: z
          .boolean()
          .optional()
          .describe("true=跳过标题/URL 查重强制新建；默认 false"),
      },
    },
    async (input) => {
      try {
        const asset = await createStudioAsset({
          title: input.title,
          projectId: input.projectId,
          assetType: input.assetType as AssetType | undefined,
          url: input.url,
          note: input.note,
          takeaway: input.takeaway,
          risk: input.risk,
          force: input.force,
        });
        await logAiAction({
          action: "create_asset",
          payload: { assetId: asset.id, projectId: asset.projectId },
        });
        return mcpJson({
          ok: true,
          asset: {
            id: asset.id,
            title: asset.title,
            projectId: asset.projectId,
            assetType: asset.assetType,
            url: asset.url,
            note: asset.note,
          },
        });
      } catch (error) {
        if (error instanceof StudioDuplicateError) {
          return mcpJson({
            ok: false,
            code: "DUPLICATE",
            kind: error.kind,
            message: error.message,
            candidates: error.candidates,
            hint: error.hint,
          });
        }
        return mcpError(error instanceof Error ? error.message : "create_asset 失败");
      }
    }
  );

  server.registerTool(
    "add_evolution",
    {
      title: "Add Evolution",
      description:
        "记录项目演进：时间/事件/原因/影响。强烈建议填写 module（功能板块）；发版时按板块汇总。可选 releaseTag 挂到某版本。",
      inputSchema: {
        projectId: z.string().min(1),
        title: z.string().min(1).describe("事件标题，如「加入小六壬体系」"),
        logType: evolutionTypeSchema.optional(),
        before: z.string().optional(),
        after: z.string().optional().describe("影响/结果"),
        reason: z.string().optional().describe("原因"),
        decision: z.string().optional(),
        module: z
          .string()
          .optional()
          .describe("功能板块（强烈建议）：工作台/项目库/灵感/需求任务/迭代记录/资源中心/Git/设置"),
        releaseTag: z.string().optional().describe("关联 GitHub Release/Tag，如 v1.9.1"),
      },
    },
    async (input) => {
      try {
        const log = await createStudioEvolution({
          title: input.title,
          projectId: input.projectId,
          logType: (input.logType as EvolutionLogType | undefined) ?? "feature_add",
          before: input.before,
          after: input.after,
          reason: input.reason,
          decision: input.decision,
          module: input.module,
          releaseTag: input.releaseTag ?? null,
        });
        await logAiAction({
          action: "add_evolution",
          payload: { evolutionId: log.id, projectId: log.projectId },
        });
        return mcpJson({
          ok: true,
          warning: log.module?.trim()
            ? undefined
            : "未填写 module（板块）。发版汇总时将归入「未分板块」，建议补写。",
          evolution: {
            id: log.id,
            title: log.title,
            projectId: log.projectId,
            logType: log.logType,
            reason: log.reason,
            after: log.after,
            decision: log.decision,
            module: log.module,
            releaseTag: log.releaseTag,
            createdAt: log.createdAt,
          },
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "add_evolution 失败");
      }
    }
  );

  server.registerTool(
    "publish_release",
    {
      title: "Publish Release",
      description:
        "按项目汇总带板块的演进，创建 GitHub Release（含本版内容与板块），并把未挂版本的演进挂到该 tag。发版前请先确保 MCP/站内写入时带了 module。",
      inputSchema: {
        projectId: z.string().min(1),
        tag: z.string().min(1).describe("版本号，如 v1.9.1"),
        name: z.string().optional().describe("Release 标题，默认用 tag"),
        targetCommitish: z
          .string()
          .optional()
          .describe("目标分支或 sha；默认用项目 githubBranch 或 main"),
        extraBody: z.string().optional().describe("额外说明，拼在正文前"),
        attachUntaggedEvolution: z
          .boolean()
          .optional()
          .describe("默认 true：把未挂版本且有板块的演进挂到本 tag"),
        draft: z.boolean().optional(),
        prerelease: z.boolean().optional(),
      },
    },
    async (input) => {
      try {
        const { publishStudioProjectRelease } = await import("@/lib/studio/mutations");
        const result = await publishStudioProjectRelease({
          projectId: input.projectId,
          tag: input.tag,
          name: input.name,
          targetCommitish: input.targetCommitish,
          extraBody: input.extraBody,
          attachUntaggedEvolution: input.attachUntaggedEvolution,
          draft: input.draft,
          prerelease: input.prerelease,
        });
        await logAiAction({
          action: "publish_release",
          payload: {
            projectId: input.projectId,
            tag: input.tag,
            modules: result.modules,
          },
        });
        return mcpJson({
          ok: true,
          ...result,
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "publish_release 失败");
      }
    }
  );

  server.registerTool(
    "add_decision",
    {
      title: "Add Decision",
      description:
        "记录产品决策（不采用什么、原因、替代方案），写入演进日志。强烈建议填写 module（功能板块）。",
      inputSchema: {
        projectId: z.string().min(1),
        decision: z.string().min(1).describe("决策内容"),
        reason: z.string().optional().describe("原因"),
        alternative: z.string().optional().describe("替代方案"),
        title: z.string().optional().describe("默认用决策摘要"),
        module: z.string().optional().describe("功能板块（强烈建议）"),
        releaseTag: z.string().optional().describe("关联版本 Tag"),
      },
    },
    async (input) => {
      try {
        const title = input.title?.trim() || `决策：${input.decision.slice(0, 40)}`;
        const log = await createStudioEvolution({
          title,
          projectId: input.projectId,
          logType: "tech_decision",
          before: input.alternative ? `备选：${input.alternative}` : "",
          after: input.decision,
          reason: input.reason ?? "",
          decision: input.decision,
          module: input.module,
          releaseTag: input.releaseTag ?? null,
        });
        await logAiAction({
          action: "add_decision",
          payload: { evolutionId: log.id, projectId: log.projectId },
        });
        return mcpJson({
          ok: true,
          warning: log.module?.trim()
            ? undefined
            : "未填写 module（板块）。发版汇总时将归入「未分板块」，建议补写。",
          evolution: {
            id: log.id,
            title: log.title,
            projectId: log.projectId,
            module: log.module,
            releaseTag: log.releaseTag,
            createdAt: log.createdAt,
          },
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "add_decision 失败");
      }
    }
  );

  server.registerTool(
    "link_item",
    {
      title: "Link Items",
      description:
        "建立关系：Idea↔Project/Module/父Idea、Task↔Idea/Project、Asset↔Project。会同步常用 FK，并写入 studio_links。",
      inputSchema: {
        sourceType: linkEntitySchema,
        sourceId: z.string().min(1),
        targetType: linkEntitySchema,
        targetId: z.string().min(1).describe("module 时填模块名"),
        relationType: z.string().optional().describe("默认 related；父灵感可用 parent"),
        note: z.string().optional(),
      },
    },
    async (input) => {
      try {
        const result = await linkItem(input);
        await logAiAction({
          action: "link_item",
          payload: result.link,
        });
        return mcpJson(result);
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "link_item 失败");
      }
    }
  );

  server.registerTool(
    "generate_brief",
    {
      title: "Generate Project Brief",
      description:
        "AI 生成项目简报（定位/为什么做/用户/阶段/风险/下一步）并默认写回 Project Memory。需要 OPENAI_API_KEY。",
      inputSchema: {
        projectId: z.string().min(1),
        save: z.boolean().optional().describe("默认 true"),
        openAiApiKey: z.string().optional(),
        openAiModel: z.string().optional(),
        openAiBaseUrl: z.string().optional(),
      },
    },
    async (input) => {
      try {
        const result = await generateProjectBrief(input.projectId, {
          save: input.save,
          credentials: {
            apiKey: input.openAiApiKey,
            model: input.openAiModel,
            baseUrl: input.openAiBaseUrl,
          },
        });
        await logAiAction({
          action: "generate_brief",
          payload: { projectId: input.projectId, saved: result.saved },
        });
        return mcpJson({ ok: true, ...result, project: slimProject(result.project) });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "generate_brief 失败");
      }
    }
  );

  server.registerTool(
    "summarize_project",
    {
      title: "Summarize Project",
      description: "AI 总结项目近况（进度/阻塞/下一步焦点）。需要 OPENAI_API_KEY。",
      inputSchema: {
        projectId: z.string().min(1),
        openAiApiKey: z.string().optional(),
        openAiModel: z.string().optional(),
        openAiBaseUrl: z.string().optional(),
      },
    },
    async (input) => {
      try {
        const result = await summarizeProject(input.projectId, {
          credentials: {
            apiKey: input.openAiApiKey,
            model: input.openAiModel,
            baseUrl: input.openAiBaseUrl,
          },
        });
        await logAiAction({
          action: "summarize_project",
          payload: { projectId: input.projectId },
        });
        return mcpJson({ ok: true, ...result });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "summarize_project 失败");
      }
    }
  );

  server.registerTool(
    "summarize_day",
    {
      title: "Summarize Day",
      description:
        "生成今日创造报告：新增 Idea / 推进项目 / 主题 / 建议。date 默认 today。需要 OPENAI_API_KEY。",
      inputSchema: {
        date: z.string().optional().describe("today 或 YYYY-MM-DD，默认 today"),
        openAiApiKey: z.string().optional(),
        openAiModel: z.string().optional(),
        openAiBaseUrl: z.string().optional(),
      },
    },
    async (input) => {
      try {
        const result = await summarizeDay(input.date?.trim() || "today", {
          credentials: {
            apiKey: input.openAiApiKey,
            model: input.openAiModel,
            baseUrl: input.openAiBaseUrl,
          },
        });
        await logAiAction({
          action: "summarize_day",
          payload: { date: result.date, newIdeas: result.report.newIdeas },
        });
        return mcpJson({ ok: true, ...result });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "summarize_day 失败");
      }
    }
  );
}
