import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAllEvolutionLogs, getProjectById, getProjectAssets, getProjectChangeSessions, getProjectIdeas, getProjectTasks, getChangeSessionById } from "@/lib/studio/data";
import {
  createChangeSession,
  createStudioAsset,
  createStudioEvolution,
  createStudioProject,
  importChangelogAsEvolution,
  importReleaseBodiesAsEvolution,
  updateChangeSession,
  updateStudioIdea,
  updateStudioProject,
  updateStudioProjectWithModuleSync,
} from "@/lib/studio/mutations";
import type {
  AssetType,
  ChangeSessionAcceptance,
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
import type { Requirement } from "@/lib/types";

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
    featureModules: project.featureModules ?? [],
    githubRepo: project.githubRepo ?? null,
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
      description:
        "更新项目状态、阶段、下一步、定位、功能板块名单等。featureModules 为完整覆盖写入（每项建议用「体系·功能面·能力」路径）；写入时会增量同步到模块树（首段→一级，其余→子模块）。",
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
        featureModules: z
          .array(z.string())
          .optional()
          .describe(
            "功能板块名单（完整覆盖）。例：[\"六爻·笔记·卦象解析\",\"八字·排盘·四柱\"]；传 [] 清空自定义（回退内置目录）"
          ),
        markShippedComplete: z
          .boolean()
          .optional()
          .describe(
            "true：把本项目已上线但未标完成的需求/任务补标完成（匹配已完成 Studio 任务、标题含 ✅/[done]、机读 status=done；父需求仅在子项全完成时标）"
          ),
      },
    },
    async (input) => {
      try {
        const { projectId, featureModules, markShippedComplete, ...patch } = input;
        const { project, moduleTreeSync } = await updateStudioProjectWithModuleSync(
          projectId,
          {
            ...patch,
            status: patch.status as ProjectStatus | undefined,
            priority: patch.priority as ProjectPriority | undefined,
            ...(featureModules !== undefined
              ? {
                  featureModules: featureModules
                    .map((m) => m.trim())
                    .filter(Boolean),
                }
              : {}),
          }
        );

        let shipped: {
          markedRequirements: number;
          markedTasks: number;
          samples: string[];
        } | null = null;
        if (markShippedComplete) {
          const { markShippedCompleteForProject } = await import(
            "@/lib/mcp/mark-shipped-complete"
          );
          shipped = await markShippedCompleteForProject(projectId);
        }

        await logAiAction({
          action: "update_project",
          payload: {
            projectId,
            patch: {
              ...patch,
              ...(featureModules !== undefined
                ? { featureModulesCount: featureModules.length }
                : {}),
              ...(markShippedComplete ? { markShippedComplete: true, shipped } : {}),
            },
          },
        });
        return mcpJson({
          ok: true,
          project: slimProject(project),
          moduleTreeSync,
          ...(shipped ? { shippedComplete: shipped } : {}),
        });
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
          .describe(
            "功能板块；留空时按标题/内容关键词自动推断（工作台/项目库/灵感/需求任务/迭代记录/资源中心/Git/设置）"
          ),
        releaseTag: z.string().optional().describe("关联 GitHub Release/Tag，如 v1.9.1"),
        workStartedAt: z
          .string()
          .optional()
          .describe("聊天开始时间 ISO（工时起点，可从对话时间戳取）"),
        workFinishedAt: z
          .string()
          .optional()
          .describe("聊天结束时间 ISO（工时终点）"),
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
          workStartedAt: input.workStartedAt ?? null,
          workFinishedAt: input.workFinishedAt ?? null,
        });
        await logAiAction({
          action: "add_evolution",
          payload: { evolutionId: log.id, projectId: log.projectId },
        });
        return mcpJson({
          ok: true,
          warning: log.module?.trim()
            ? undefined
            : "未能填写或推断 module（板块）。发版汇总时将归入「未分板块」，建议补写。",
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
            workStartedAt: log.workStartedAt,
            workFinishedAt: log.workFinishedAt,
            createdAt: log.createdAt,
          },
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "add_evolution 失败");
      }
    }
  );

  server.registerTool(
    "update_evolution",
    {
      title: "Update Evolution",
      description: "更新演进标题/板块/版本号等（用于修编码损坏标题、补板块）。",
      inputSchema: {
        evolutionId: z.string().min(1),
        title: z.string().optional(),
        module: z.string().optional(),
        releaseTag: z.string().nullable().optional(),
        after: z.string().optional(),
        reason: z.string().optional(),
        decision: z.string().optional(),
        workStartedAt: z.string().nullable().optional().describe("工时起点 ISO；null 清空"),
        workFinishedAt: z.string().nullable().optional().describe("工时终点 ISO；null 清空"),
      },
    },
    async (input) => {
      try {
        const { updateStudioEvolution } = await import("@/lib/studio/mutations");
        const { evolutionId, ...patch } = input;
        const log = await updateStudioEvolution(evolutionId, patch);
        await logAiAction({
          action: "update_evolution",
          payload: { evolutionId: log.id, title: log.title },
        });
        return mcpJson({
          ok: true,
          evolution: {
            id: log.id,
            title: log.title,
            module: log.module,
            releaseTag: log.releaseTag,
            after: log.after,
            workStartedAt: log.workStartedAt,
            workFinishedAt: log.workFinishedAt,
          },
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "update_evolution 失败");
      }
    }
  );

  server.registerTool(
    "list_evolutions",
    {
      title: "List Evolutions",
      description: "列出项目演进；可按标题含问号等过滤，便于修复编码损坏条目。",
      inputSchema: {
        projectId: z.string().min(1),
        titleContains: z.string().optional().describe("标题包含，如 ?"),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (input) => {
      try {
        const { getProjectEvolution } = await import("@/lib/studio/data");
        let logs = await getProjectEvolution(input.projectId);
        if (input.titleContains) {
          logs = logs.filter((l) => l.title.includes(input.titleContains!));
        }
        const limit = input.limit ?? 50;
        const slim = logs.slice(0, limit).map((l) => ({
          id: l.id,
          title: l.title,
          module: l.module,
          releaseTag: l.releaseTag,
          createdAt: l.createdAt,
          after: l.after?.slice(0, 120) ?? "",
        }));
        return mcpJson({ ok: true, count: logs.length, returned: slim.length, evolutions: slim });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "list_evolutions 失败");
      }
    }
  );

  server.registerTool(
    "repair_corrupt_evolution_titles",
    {
      title: "Repair Corrupt Evolution Titles",
      description:
        "把标题含「?」的演进按仓库 CHANGELOG 匹配并写回中文标题（编码损坏修复）。默认 dryRun=true。",
      inputSchema: {
        projectId: z.string().min(1),
        dryRun: z.boolean().optional().describe("默认 true：只预览不写库"),
      },
    },
    async (input) => {
      try {
        const { getProjectEvolution } = await import("@/lib/studio/data");
        const { updateStudioEvolution } = await import("@/lib/studio/mutations");
        const {
          buildChangelogEvolutionItems,
          readRepoChangelog,
        } = await import("@/lib/studio/import-changelog");

        const logs = (await getProjectEvolution(input.projectId)).filter((l) =>
          l.title.includes("?")
        );
        const md = readRepoChangelog();
        const candidates = buildChangelogEvolutionItems(md, input.projectId);

        function score(corrupt: string, cand: string): number {
          if (corrupt.includes("studio_app_settings") && cand.includes("studio_app_settings")) {
            return 900;
          }
          if (corrupt.length === cand.length) {
            let ok = 0;
            let fixed = 0;
            for (let i = 0; i < corrupt.length; i++) {
              if (corrupt[i] === "?") continue;
              fixed += 1;
              if (corrupt[i] === cand[i]) ok += 1;
            }
            if (fixed > 0 && ok === fixed) return 800 + ok;
          }
          // ASCII fingerprint
          const ascii = corrupt.replace(/[^A-Za-z0-9_.:()+\-\/]/g, "");
          if (ascii.length >= 6 && cand.replace(/\s/g, "").includes(ascii.slice(0, 12))) {
            return 600 + ascii.length;
          }
          return -1;
        }

        const plan: Array<{
          id: string;
          oldTitle: string;
          newTitle: string | null;
          releaseTag: string | null;
          score: number;
        }> = [];

        for (const log of logs) {
          let best: (typeof candidates)[number] | null = null;
          let bestScore = -1;
          for (const c of candidates) {
            const s = score(log.title, c.title);
            if (s > bestScore) {
              bestScore = s;
              best = c;
            }
          }
          plan.push({
            id: log.id,
            oldTitle: log.title,
            newTitle: bestScore >= 500 ? best!.title : null,
            releaseTag: bestScore >= 500 ? best!.releaseTag : null,
            score: bestScore,
          });
        }

        const dryRun = input.dryRun !== false;
        const applied: string[] = [];
        if (!dryRun) {
          for (const p of plan) {
            if (!p.newTitle) continue;
            await updateStudioEvolution(p.id, {
              title: p.newTitle,
              releaseTag: p.releaseTag,
            });
            applied.push(p.id);
          }
        }

        await logAiAction({
          action: "repair_corrupt_evolution_titles",
          payload: {
            projectId: input.projectId,
            dryRun,
            found: plan.length,
            matched: plan.filter((p) => p.newTitle).length,
            applied: applied.length,
          },
        });

        return mcpJson({
          ok: true,
          dryRun,
          found: plan.length,
          matched: plan.filter((p) => p.newTitle).length,
          applied: applied.length,
          plan,
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "repair_corrupt_evolution_titles 失败"
        );
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
        let shippedSuggestions: unknown = null;
        try {
          const { suggestShippedFromRelease } = await import(
            "@/lib/mcp/suggest-shipped-from-release"
          );
          shippedSuggestions = await suggestShippedFromRelease({
            projectId: input.projectId,
            tag: input.tag,
          });
        } catch (suggestErr) {
          shippedSuggestions = {
            error:
              suggestErr instanceof Error
                ? suggestErr.message
                : "suggest_shipped_from_release 失败",
          };
        }
        await logAiAction({
          action: "publish_release",
          payload: {
            projectId: input.projectId,
            tag: input.tag,
            modules: result.modules,
            shippedCandidateCount:
              shippedSuggestions &&
              typeof shippedSuggestions === "object" &&
              "candidates" in shippedSuggestions
                ? (shippedSuggestions as { candidates: unknown[] }).candidates.length
                : 0,
          },
        });
        return mcpJson({
          ok: true,
          ...result,
          shippedSuggestions,
          nextStep:
            "若 shippedSuggestions.candidates 非空：核对后调用 confirm_shipped_requirements（传入 requirementIds + completedAtHint），不会自动改状态。",
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "publish_release 失败");
      }
    }
  );

  server.registerTool(
    "suggest_shipped_from_release",
    {
      title: "Suggest shipped requirements from release",
      description:
        "根据 CHANGELOG 某 tag 条目 + 已挂该 tag 的演进，模糊匹配未完成需求，返回候选列表（不改状态）。发版后可单独调用；publish_release 也会附带同结构 shippedSuggestions。",
      inputSchema: {
        projectId: z.string().min(1),
        tag: z.string().min(1).describe("版本号，如 v1.10.62"),
      },
    },
    async (input) => {
      try {
        const { suggestShippedFromRelease } = await import(
          "@/lib/mcp/suggest-shipped-from-release"
        );
        const result = await suggestShippedFromRelease({
          projectId: input.projectId,
          tag: input.tag,
        });
        return mcpJson({ ok: true, ...result });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "suggest_shipped_from_release 失败"
        );
      }
    }
  );

  server.registerTool(
    "confirm_shipped_requirements",
    {
      title: "Confirm shipped requirements",
      description:
        "将选定需求标为完成并写入 completed_at。用于确认 suggest_shipped_from_release / publish_release.shippedSuggestions 的候选，禁止静默全量应用。",
      inputSchema: {
        requirementIds: z.array(z.string().min(1)).min(1),
        completedAt: z
          .string()
          .optional()
          .describe("完成时间 ISO；默认用建议的 completedAtHint 或现在"),
      },
    },
    async (input) => {
      try {
        const { confirmShippedRequirements } = await import(
          "@/lib/mcp/suggest-shipped-from-release"
        );
        const result = await confirmShippedRequirements({
          requirementIds: input.requirementIds,
          completedAt: input.completedAt,
        });
        await logAiAction({
          action: "confirm_shipped_requirements",
          payload: {
            marked: result.marked,
            failed: result.failed.length,
            completedAt: result.completedAt,
          },
        });
        return mcpJson({ ok: true, ...result });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "confirm_shipped_requirements 失败"
        );
      }
    }
  );

  server.registerTool(
    "list_git_sync_suggestions",
    {
      title: "List git sync suggestions",
      description:
        "列出 sync-git 后由 commit message 模糊匹配产生的待确认建议（不改状态）。每日 cron / 手动同步后可查。",
      inputSchema: {
        pmProjectId: z.string().optional().describe("PM 项目 id，可选过滤"),
        studioProjectId: z.string().optional().describe("Studio 项目 id，可选过滤"),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (input) => {
      try {
        const { listPendingGitSyncSuggestions } = await import(
          "@/lib/mcp/suggest-from-commits"
        );
        const result = await listPendingGitSyncSuggestions({
          pmProjectId: input.pmProjectId,
          studioProjectId: input.studioProjectId,
          limit: input.limit,
        });
        return mcpJson({ ok: true, ...result });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "list_git_sync_suggestions 失败"
        );
      }
    }
  );

  server.registerTool(
    "confirm_git_sync_suggestions",
    {
      title: "Confirm git sync suggestions",
      description:
        "确认或忽略 list_git_sync_suggestions 的候选。accept=标完成并写入 completed_at；dismiss=仅关闭建议。禁止静默全量应用。",
      inputSchema: {
        suggestionIds: z.array(z.string().min(1)).min(1),
        action: z.enum(["accept", "dismiss"]),
        completedAt: z
          .string()
          .optional()
          .describe("accept 时的完成时间 ISO；默认现在"),
      },
    },
    async (input) => {
      try {
        const { confirmGitSyncSuggestions } = await import(
          "@/lib/mcp/suggest-from-commits"
        );
        const result = await confirmGitSyncSuggestions({
          suggestionIds: input.suggestionIds,
          action: input.action,
          completedAt: input.completedAt,
        });
        await logAiAction({
          action: "confirm_git_sync_suggestions",
          payload: {
            action: result.action,
            resolved: result.resolved,
            marked: result.marked ?? 0,
            missing: result.missing.length,
          },
        });
        return mcpJson({ ok: true, ...result });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "confirm_git_sync_suggestions 失败"
        );
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
    "import_changelog_evolution",
    {
      title: "Import Changelog Evolution",
      description:
        "将 CHANGELOG 或已同步 Release body 的各版本条目导入为演进：每条带 releaseTag，并按关键词推断功能板块。未传 markdown 时默认读仓库 CHANGELOG.md；传 fromReleases:true 则从已同步 Release 说明导入。",
      inputSchema: {
        projectId: z.string().min(1),
        markdown: z.string().optional().describe("可选：直接传 CHANGELOG 全文"),
        fromReleases: z
          .boolean()
          .optional()
          .describe("true=从已同步的 Release/Tag body 导入，忽略 markdown"),
      },
    },
    async (input) => {
      try {
        if (input.fromReleases) {
          const result = await importReleaseBodiesAsEvolution(input.projectId);
          await logAiAction({
            action: "import_release_bodies_evolution",
            payload: { projectId: input.projectId, ...result },
          });
          return mcpJson({ ok: true, source: "releases", ...result });
        }
        const result = await importChangelogAsEvolution({
          projectId: input.projectId,
          markdown: input.markdown,
          fromRepoFile: !input.markdown,
        });
        await logAiAction({
          action: "import_changelog_evolution",
          payload: {
            projectId: input.projectId,
            imported: result.imported,
            skipped: result.skipped,
          },
        });
        return mcpJson({ ok: true, source: "changelog", ...result });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "import_changelog_evolution 失败"
        );
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

  const stringList = z.array(z.string()).optional();
  const acceptanceSchema = z.enum(["unreviewed", "passed", "rejected"]);

  server.registerTool(
    "start_change_session",
    {
      title: "Start Change Session",
      description:
        "改东西之前开一条 AI 变更会话：写修改目标/原因/期望效果。返回 sessionId，改完后用 finish_change_session。",
      inputSchema: {
        projectId: z.string().min(1),
        goal: z.string().min(1).describe("修改目标"),
        reason: z.string().optional().describe("修改原因"),
        expected: stringList.describe("期望效果列表"),
        module: z.string().optional(),
        requirementId: z.string().nullable().optional(),
        ideaId: z.string().nullable().optional(),
        day: z.string().optional().describe("YYYY-MM-DD，默认今天（上海）"),
        startedAt: z
          .string()
          .optional()
          .describe("聊天开始时间 ISO；缺省为现在"),
      },
    },
    async (input) => {
      try {
        const session = await createChangeSession({
          projectId: input.projectId,
          goal: input.goal,
          reason: input.reason,
          expected: input.expected,
          module: input.module,
          requirementId: input.requirementId,
          ideaId: input.ideaId,
          day: input.day,
          startedAt: input.startedAt,
        });
        await logAiAction({
          action: "start_change_session",
          payload: { sessionId: session.id, projectId: session.projectId },
        });
        return mcpJson({ ok: true, session });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "start_change_session 失败");
      }
    }
  );

  server.registerTool(
    "finish_change_session",
    {
      title: "Finish Change Session",
      description:
        "改完后收尾变更会话：写入 ✅/❌、aiOps、result。默认进入待验清单并 PushPlus/站内提醒（不自动标已验收）。acceptancePolicy：remind=只提醒；user_waived=用户明确免验则 passed；auto_pass_small=小修/bug 自动 passed。省略时：像小修/bug 且无 pending → 自动过，否则提醒。",
      inputSchema: {
        sessionId: z.string().min(1),
        doneItems: stringList.describe("已完成项"),
        pendingItems: stringList.describe("未完成项"),
        aiOps: stringList.describe("AI 操作摘要，如改了哪些文件"),
        result: z.string().optional(),
        finishedAt: z
          .string()
          .optional()
          .describe("聊天结束时间 ISO；缺省为现在"),
        acceptancePolicy: z
          .enum(["remind", "auto_pass_small", "user_waived"])
          .optional()
          .describe(
            "验收策略：remind | auto_pass_small | user_waived（用户说这次不用验/直接过）"
          ),
      },
    },
    async (input) => {
      try {
        let session = await updateChangeSession(input.sessionId, {
          action: "finish",
          doneItems: input.doneItems,
          pendingItems: input.pendingItems,
          aiOps: input.aiOps,
          result: input.result,
          finishedAt: input.finishedAt,
        });
        const { applyAcceptanceAfterFinish } = await import(
          "@/lib/notify/acceptance-flow"
        );
        const acceptance = await applyAcceptanceAfterFinish({
          session,
          policy: input.acceptancePolicy,
        });
        session = acceptance.session;
        await logAiAction({
          action: "finish_change_session",
          payload: {
            sessionId: session.id,
            acceptancePolicy: acceptance.policy,
            autoPass: acceptance.autoPass,
            pushOk: acceptance.push.ok,
          },
        });
        return mcpJson({
          ok: true,
          session,
          acceptance: {
            policy: acceptance.policy,
            autoPass: acceptance.autoPass,
            reason: acceptance.reason,
            humanAcceptance: session.humanAcceptance,
            push: acceptance.push,
            nextStep: acceptance.autoPass
              ? "已自动标 passed（小修或用户免验）。大功能若误过，可 update_change_session 改回 unreviewed。"
              : "已进工作台待验收清单并尝试 PushPlus。请用户在工作台点通过/退回；退回时记 Bug/优化到 PM。",
          },
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "finish_change_session 失败");
      }
    }
  );

  server.registerTool(
    "update_change_session",
    {
      title: "Update Change Session",
      description: "补记或改验收状态（passed/rejected/unreviewed）；也可改 goal/reason/expected 等。",
      inputSchema: {
        sessionId: z.string().min(1),
        goal: z.string().optional(),
        reason: z.string().optional(),
        expected: stringList,
        doneItems: stringList,
        pendingItems: stringList,
        aiOps: stringList,
        result: z.string().optional(),
        humanAcceptance: acceptanceSchema.optional(),
        module: z.string().optional(),
        status: z.enum(["open", "finished"]).optional(),
      },
    },
    async (input) => {
      try {
        const { sessionId, ...patch } = input;
        const session = await updateChangeSession(sessionId, {
          ...patch,
          humanAcceptance: patch.humanAcceptance as ChangeSessionAcceptance | undefined,
        });
        await logAiAction({
          action: "update_change_session",
          payload: { sessionId },
        });
        return mcpJson({ ok: true, session });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "update_change_session 失败");
      }
    }
  );

  server.registerTool(
    "send_test_push",
    {
      title: "Send test PushPlus",
      description:
        "用 PUSHPLUS_TOKEN 发一条测试微信推送，确认 PushPlus 配置是否可用。",
      inputSchema: {
        title: z.string().optional().describe("默认：Star PM · 测试推送"),
        content: z.string().optional().describe("默认说明文字"),
      },
    },
    async (input) => {
      try {
        const { sendPushPlus, getPushPlusToken } = await import(
          "@/lib/notify/pushplus"
        );
        if (!getPushPlusToken()) {
          return mcpError("未配置 PUSHPLUS_TOKEN（.env.local / 部署环境变量）");
        }
        const push = await sendPushPlus({
          title: input.title?.trim() || "Star PM · 测试推送",
          content:
            input.content?.trim() ||
            "若你收到这条微信消息，说明 PushPlus 已接通。",
        });
        if (!push.ok) return mcpError(push.error);
        return mcpJson({ ok: true, push });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "send_test_push 失败");
      }
    }
  );

  server.registerTool(
    "list_change_sessions",
    {
      title: "List Change Sessions",
      description: "列出项目的 AI 变更会话；可按 day（YYYY-MM-DD）过滤。",
      inputSchema: {
        projectId: z.string().min(1),
        day: z.string().optional(),
      },
    },
    async (input) => {
      try {
        const sessions = await getProjectChangeSessions(
          input.projectId,
          input.day?.trim() || undefined
        );
        return mcpJson({ ok: true, count: sessions.length, sessions });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "list_change_sessions 失败");
      }
    }
  );

  server.registerTool(
    "get_change_session",
    {
      title: "Get Change Session",
      description: "按 id 获取一条变更会话。",
      inputSchema: {
        sessionId: z.string().min(1),
      },
    },
    async (input) => {
      try {
        const session = await getChangeSessionById(input.sessionId);
        if (!session) return mcpError("变更会话不存在");
        return mcpJson({ ok: true, session });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "get_change_session 失败");
      }
    }
  );

  server.registerTool(
    "list_requirements",
    {
      title: "List Requirements",
      description:
        "列出项目需求池+已上板需求（含状态/优先级/完成时间）。projectId 可为 Studio id 或 PM slug。",
      inputSchema: {
        projectId: z.string().min(1),
        status: z
          .string()
          .optional()
          .describe("可选：按生命周期过滤，如 完成 / 想法 / AI开发中 / 开发中"),
        limit: z.number().int().min(1).max(500).optional(),
      },
    },
    async (input) => {
      try {
        const { resolveProjectRoute } = await import("@/lib/project-bridge");
        const { requirementIsDone } = await import("@/lib/types");
        const { requirementLifecycleStatus } = await import("@/lib/requirement-status");
        const ctx = await resolveProjectRoute(input.projectId);
        const slug = ctx.pmSlug ?? input.projectId;
        const { getPoolBundle, getProjectBundle, getProjects } = await import(
          "@/lib/db/local-store"
        );

        const studioId =
          ctx.studio?.id ??
          (input.projectId.startsWith("proj-") ? input.projectId : null);
        const pmAll = await getProjects();
        const keys = [
          slug,
          studioId ? `studio-${studioId}` : null,
          input.projectId,
          ctx.studio ? pmAll.find((p) => p.name === ctx.studio!.title)?.slug : null,
          ctx.studio ? pmAll.find((p) => p.name === ctx.studio!.title)?.id : null,
        ].filter(Boolean) as string[];

        const byId = new Map<string, Requirement>();
        let usedKey = slug;
        for (const key of keys) {
          const [pool, board] = await Promise.all([
            getPoolBundle(key).catch(() => null),
            getProjectBundle(key).catch(() => null),
          ]);
          const list = [
            ...(pool?.poolRequirements ?? []),
            ...(board?.requirements ?? []),
          ];
          if (list.length > 0) {
            usedKey = key;
            for (const r of list) byId.set(r.id, r);
          }
        }
        let reqs = [...byId.values()];
        const doneCountAll = reqs.filter((r) => requirementIsDone(r)).length;
        if (input.status?.trim()) {
          const want = input.status.trim();
          reqs = reqs.filter((r) => requirementLifecycleStatus(r) === want);
        }
        const limit = input.limit ?? 200;
        const slim = reqs.slice(0, limit).map((r) => ({
          id: r.id,
          title: r.title,
          priority: r.priority,
          status: r.status,
          statusTags: r.status_tags,
          lifecycle: requirementLifecycleStatus(r),
          done: requirementIsDone(r),
          completedAt: r.completed_at,
          inPool: r.in_pool,
          parentId: r.parent_id,
          type: r.type,
          iterationId: r.iteration_id,
          productEstimateHours: r.product_estimate_hours,
          directHours: r.direct_hours,
          submittedAt: r.submitted_at,
        }));
        await logAiAction({
          action: "list_requirements",
          payload: {
            projectId: input.projectId,
            count: reqs.length,
            doneCount: doneCountAll,
            usedKey,
          },
        });
        return mcpJson({
          ok: true,
          projectId: input.projectId,
          pmSlug: usedKey,
          count: reqs.length,
          doneCount: doneCountAll,
          returned: slim.length,
          requirements: slim,
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "list_requirements 失败");
      }
    }
  );

  server.registerTool(
    "update_requirement",
    {
      title: "Update Requirement",
      description:
        "更新需求状态/优先级等。标完成时传 statusTags:[\"完成\"] 或 lifecycle:\"完成\"；会写 completed_at。",
      inputSchema: {
        requirementId: z.string().min(1),
        statusTags: z.array(z.string()).optional(),
        lifecycle: z
          .string()
          .optional()
          .describe("规范生命周期：想法/已规划/AI开发中/开发中/待验收/完成/放弃"),
        priority: z.string().nullable().optional(),
        title: z.string().optional(),
        forceClosed: z.boolean().optional().describe("父需求强制关闭（放弃）"),
        completedAt: z.string().nullable().optional().describe("ISO；标完成时可指定完成时间"),
        parentId: z.string().nullable().optional().describe("挂到父需求 id；null 取消挂父"),
        type: z.enum(["epic", "feature", "task"]).optional(),
        moduleL1Id: z.string().nullable().optional().describe("一级模块 id"),
        iterationId: z
          .string()
          .optional()
          .describe("挂到规划迭代 id（可仍留需求池）"),
        productEstimateHours: z
          .number()
          .nullable()
          .optional()
          .describe("叶子预计工时（需求池「工时」列）"),
        directHours: z
          .number()
          .nullable()
          .optional()
          .describe("父节点附加直接工时"),
      },
    },
    async (input) => {
      try {
        const { updateRequirement } = await import("@/lib/db/local-store");
        const { applyLifecycleStatus, requirementLifecycleStatus } = await import(
          "@/lib/requirement-status"
        );
        const { AGENT_ACTOR_NAME } = await import("@/lib/cursor-actor");
        const { requirementIsDone } = await import("@/lib/types");

        let status_tags = input.statusTags;
        if (input.lifecycle?.trim()) {
          status_tags = applyLifecycleStatus(status_tags ?? [], input.lifecycle.trim());
        }
        const updates: {
          status_tags?: string[];
          priority?: string | null;
          title?: string;
          force_closed?: boolean;
          completed_at?: string | null;
          parent_id?: string | null;
          type?: import("@/lib/types").RequirementType;
          module_l1_id?: string | null;
          iteration_id?: string;
          product_estimate_hours?: number | null;
          direct_hours?: number | null;
        } = {};
        if (status_tags) updates.status_tags = status_tags;
        if (input.priority !== undefined) updates.priority = input.priority;
        if (input.title !== undefined) updates.title = input.title;
        if (input.forceClosed !== undefined) updates.force_closed = input.forceClosed;
        if (input.completedAt !== undefined) updates.completed_at = input.completedAt;
        if (input.parentId !== undefined) updates.parent_id = input.parentId;
        if (input.type !== undefined) updates.type = input.type;
        if (input.moduleL1Id !== undefined) updates.module_l1_id = input.moduleL1Id;
        if (input.iterationId !== undefined) updates.iteration_id = input.iterationId;
        if (input.productEstimateHours !== undefined) {
          updates.product_estimate_hours = input.productEstimateHours;
        }
        if (input.directHours !== undefined) updates.direct_hours = input.directHours;

        const req = await updateRequirement(input.requirementId, updates, {
          name: AGENT_ACTOR_NAME,
          role: "ai",
        });

        await logAiAction({
          action: "update_requirement",
          payload: { requirementId: req.id, lifecycle: requirementLifecycleStatus(req) },
        });
        return mcpJson({
          ok: true,
          requirement: {
            id: req.id,
            title: req.title,
            priority: req.priority,
            statusTags: req.status_tags,
            lifecycle: requirementLifecycleStatus(req),
            done: requirementIsDone(req),
            completedAt: req.completed_at,
            iterationId: req.iteration_id,
            productEstimateHours: req.product_estimate_hours,
            directHours: req.direct_hours,
          },
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "update_requirement 失败");
      }
    }
  );

  server.registerTool(
    "create_bug",
    {
      title: "Create Bug",
      description:
        "在 PM 项目下创建 Bug（写入 bugs 表）。projectId 可为 Studio id（如 proj-star-pm）或 PM slug。",
      inputSchema: {
        projectId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        reproSteps: z.string().optional(),
        severity: z.number().int().min(1).max(4).optional().describe("1致命…4轻微，默认 3"),
        bugType: z
          .enum(["code", "ui", "performance", "security", "design", "config", "install", "other"])
          .optional(),
        requirementId: z.string().nullable().optional(),
        assignee: z.string().optional(),
        status: z
          .enum(["pending", "in_progress", "done", "blocked", "acceptance"])
          .optional(),
      },
    },
    async (input) => {
      try {
        const { resolveProjectRoute } = await import("@/lib/project-bridge");
        const { createBug, getProjects, updateBug } = await import("@/lib/db/local-store");
        type BugStatus = import("@/lib/types").TaskStatus;
        const ctx = await resolveProjectRoute(input.projectId);
        const pmAll = await getProjects();
        const pm =
          (ctx.pmSlug ? pmAll.find((p) => p.slug === ctx.pmSlug) : null) ||
          pmAll.find((p) => p.id === input.projectId) ||
          pmAll.find((p) => p.slug === input.projectId) ||
          (ctx.studio ? pmAll.find((p) => p.name === ctx.studio!.title) : null);
        if (!pm) {
          return mcpError(`找不到 PM 项目：${input.projectId}`);
        }

        let bug = await createBug({
          project_id: pm.id,
          requirement_id: input.requirementId ?? null,
          title: input.title.trim(),
          description: input.description,
          repro_steps: input.reproSteps,
          assignee: input.assignee,
          severity: (input.severity as 1 | 2 | 3 | 4 | undefined) ?? 3,
          bug_type: input.bugType ?? "other",
        });

        if (input.status && input.status !== "pending") {
          bug = await updateBug(bug.id, { status: input.status as BugStatus });
        }

        await logAiAction({
          action: "create_bug",
          payload: { bugId: bug.id, projectId: pm.id, title: bug.title },
        });

        return mcpJson({
          ok: true,
          bug: {
            id: bug.id,
            title: bug.title,
            projectId: bug.project_id,
            pmSlug: pm.slug,
            status: bug.status,
            severity: bug.severity,
            bugType: bug.bug_type,
          },
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "create_bug 失败");
      }
    }
  );

  server.registerTool(
    "list_bugs",
    {
      title: "List Bugs",
      description: "列出项目 Bug。projectId 可为 Studio id 或 PM slug；可按 status 过滤。",
      inputSchema: {
        projectId: z.string().min(1),
        status: z
          .enum(["pending", "in_progress", "done", "blocked", "acceptance"])
          .optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (input) => {
      try {
        const { resolveProjectRoute } = await import("@/lib/project-bridge");
        const { getProjects, listBugsByProject } = await import("@/lib/db/local-store");
        const ctx = await resolveProjectRoute(input.projectId);
        const pmAll = await getProjects();
        const pm =
          (ctx.pmSlug ? pmAll.find((p) => p.slug === ctx.pmSlug) : null) ||
          pmAll.find((p) => p.id === input.projectId) ||
          pmAll.find((p) => p.slug === input.projectId) ||
          (ctx.studio ? pmAll.find((p) => p.name === ctx.studio!.title) : null);
        if (!pm) return mcpError(`找不到 PM 项目：${input.projectId}`);

        let bugs = await listBugsByProject(pm.id);
        if (input.status) bugs = bugs.filter((b) => b.status === input.status);
        const limit = input.limit ?? 50;
        const slim = bugs.slice(0, limit).map((b) => ({
          id: b.id,
          title: b.title,
          status: b.status,
          severity: b.severity,
          bugType: b.bug_type,
          description: b.description,
          createdAt: b.created_at,
        }));
        return mcpJson({
          ok: true,
          pmSlug: pm.slug,
          count: bugs.length,
          returned: slim.length,
          bugs: slim,
        });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "list_bugs 失败");
      }
    }
  );

  server.registerTool(
    "organize_star_pm_req_tree",
    {
      title: "Organize Star PM Req Tree",
      description:
        "整理 Star PM 需求散条：同步功能板块到模块树、按关键词挂到父 epic、写入 module_l1。dry=true 只预览。",
      inputSchema: {
        dry: z.boolean().optional().describe("true=只统计不写入"),
      },
    },
    async (input) => {
      try {
        const { organizeStarPmRequirementTree } = await import(
          "@/lib/studio/organize-req-tree"
        );
        const result = await organizeStarPmRequirementTree({ dry: input.dry === true });
        await logAiAction({
          action: "organize_star_pm_req_tree",
          payload: {
            dry: input.dry === true,
            reparented: result.reparented,
            moduleTagged: result.moduleTagged,
          },
        });
        return mcpJson({
          ok: true,
          ...result,
          unmatchedPreview: result.unmatched.slice(0, 40),
          unmatchedCount: result.unmatched.length,
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "organize_star_pm_req_tree 失败"
        );
      }
    }
  );

  server.registerTool(
    "list_iterations",
    {
      title: "List Planning Iterations",
      description: "列出项目规划迭代（不含需求池）。projectId 可为 Studio id 或 PM slug。",
      inputSchema: {
        projectId: z.string().min(1),
      },
    },
    async (input) => {
      try {
        const { resolveProjectRoute } = await import("@/lib/project-bridge");
        const { getProjects, getPoolBundle } = await import("@/lib/db/local-store");
        const ctx = await resolveProjectRoute(input.projectId);
        const pmAll = await getProjects();
        const pm =
          (ctx.pmSlug ? pmAll.find((p) => p.slug === ctx.pmSlug) : null) ||
          pmAll.find((p) => p.id === input.projectId) ||
          pmAll.find((p) => p.slug === input.projectId) ||
          (ctx.studio ? pmAll.find((p) => p.name === ctx.studio!.title) : null);
        if (!pm) return mcpError(`找不到项目：${input.projectId}`);
        const bundle = await getPoolBundle(pm.id);
        const iterations = (bundle?.activeIterations ?? []).map((i) => ({
          id: i.id,
          name: i.name,
          startDate: i.start_date,
          endDate: i.end_date,
          releaseTag: i.release_tag,
          sortOrder: i.sort_order,
        }));
        return mcpJson({ ok: true, projectId: pm.id, pmSlug: pm.slug, iterations });
      } catch (error) {
        return mcpError(error instanceof Error ? error.message : "list_iterations 失败");
      }
    }
  );

  server.registerTool(
    "create_planning_iteration",
    {
      title: "Create Planning Iteration",
      description: "创建规划迭代（一期=小版本）。name / release_tag / 起止日。",
      inputSchema: {
        projectId: z.string().min(1),
        name: z.string().min(1),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        releaseTag: z.string().nullable().optional(),
      },
    },
    async (input) => {
      try {
        const { resolveProjectRoute } = await import("@/lib/project-bridge");
        const { createPlanningIteration, getProjects } = await import("@/lib/db/local-store");
        const ctx = await resolveProjectRoute(input.projectId);
        const pmAll = await getProjects();
        const pm =
          (ctx.pmSlug ? pmAll.find((p) => p.slug === ctx.pmSlug) : null) ||
          pmAll.find((p) => p.id === input.projectId) ||
          pmAll.find((p) => p.slug === input.projectId) ||
          (ctx.studio ? pmAll.find((p) => p.name === ctx.studio!.title) : null);
        if (!pm) return mcpError(`找不到项目：${input.projectId}`);
        const iter = await createPlanningIteration({
          projectId: pm.id,
          name: input.name,
          start_date: input.startDate ?? null,
          end_date: input.endDate ?? null,
          release_tag: input.releaseTag ?? null,
        });
        await logAiAction({
          action: "create_planning_iteration",
          payload: { iterationId: iter.id, name: iter.name, projectId: pm.id },
        });
        return mcpJson({
          ok: true,
          iteration: {
            id: iter.id,
            name: iter.name,
            startDate: iter.start_date,
            endDate: iter.end_date,
            releaseTag: iter.release_tag,
          },
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "create_planning_iteration 失败"
        );
      }
    }
  );

  server.registerTool(
    "update_planning_iteration",
    {
      title: "Update Planning Iteration",
      description: "更新规划迭代名称/起止日/release_tag。",
      inputSchema: {
        iterationId: z.string().min(1),
        name: z.string().optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        releaseTag: z.string().nullable().optional(),
      },
    },
    async (input) => {
      try {
        const { updatePlanningIteration } = await import("@/lib/db/local-store");
        const updates: {
          name?: string;
          start_date?: string | null;
          end_date?: string | null;
          release_tag?: string | null;
        } = {};
        if (input.name !== undefined) updates.name = input.name;
        if (input.startDate !== undefined) updates.start_date = input.startDate;
        if (input.endDate !== undefined) updates.end_date = input.endDate;
        if (input.releaseTag !== undefined) updates.release_tag = input.releaseTag;
        const iter = await updatePlanningIteration(input.iterationId, updates);
        await logAiAction({
          action: "update_planning_iteration",
          payload: { iterationId: iter.id, updates },
        });
        return mcpJson({
          ok: true,
          iteration: {
            id: iter.id,
            name: iter.name,
            startDate: iter.start_date,
            endDate: iter.end_date,
            releaseTag: iter.release_tag,
          },
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "update_planning_iteration 失败"
        );
      }
    }
  );

  server.registerTool(
    "align_project_periods",
    {
      title: "Align Periods And Hours",
      description:
        "建/对齐规划迭代起止与 release_tag；默认只建议归期不覆盖 iteration_id（assignIterations=true 才按提出日强挂）。可选回填叶子 product_estimate_hours。时间窗复盘请看迭代面板「按时间」。",
      inputSchema: {
        projectId: z.string().min(1).describe("Studio id 或 PM slug；传 all 则扫活跃项目"),
        dryRun: z.boolean().optional().describe("只预览不写库"),
        fillHours: z.boolean().optional().describe("默认 true；false 只处理期次不写工时"),
        assignIterations: z
          .boolean()
          .optional()
          .describe("默认 false；true 才按首次提出时间覆盖挂期"),
      },
    },
    async (input) => {
      try {
        const {
          alignAllActiveProjects,
          alignProjectPeriodsAndHours,
        } = await import("@/lib/mcp/align-periods-hours");
        if (input.projectId === "all") {
          const results = await alignAllActiveProjects({
            dryRun: input.dryRun,
            fillHours: input.fillHours,
            assignIterations: input.assignIterations,
          });
          await logAiAction({
            action: "align_project_periods",
            payload: { projectId: "all", count: results.length },
          });
          return mcpJson({ ok: true, results });
        }
        const result = await alignProjectPeriodsAndHours(input.projectId, {
          dryRun: input.dryRun,
          fillHours: input.fillHours,
          assignIterations: input.assignIterations,
        });
        await logAiAction({
          action: "align_project_periods",
          payload: {
            projectId: result.projectId,
            assigned: result.requirementsAssigned,
            suggested: result.requirementsSuggested,
            hoursFilled: result.hoursFilled,
            assignIterations: result.assignIterations,
          },
        });
        return mcpJson({ ok: true, result });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "align_project_periods 失败"
        );
      }
    }
  );
}
