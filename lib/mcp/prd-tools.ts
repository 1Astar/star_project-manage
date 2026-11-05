import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logAiAction } from "@/lib/mcp/action-log";
import { mcpError, mcpJson } from "@/lib/mcp/response";

function slimPrd(p: {
  id: string;
  project_id: string;
  title: string;
  module_path: string | null;
  html_content: string;
  share_token: string | null;
  created_at: string;
  updated_at: string;
  versions?: unknown;
}) {
  return {
    id: p.id,
    projectId: p.project_id,
    title: p.title,
    modulePath: p.module_path,
    htmlChars: (p.html_content ?? "").length,
    shareToken: p.share_token,
    versionCount: Array.isArray(p.versions) ? p.versions.length : undefined,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

/**
 * PRD 工作区 MCP：list / create / update。
 * 写入 project_prds，出现在项目「PRD」页签（不是 Wiki 子页）。
 */
export function registerPrdTools(server: McpServer) {
  server.registerTool(
    "list_prds",
    {
      title: "List PRDs",
      description:
        "列出项目「PRD」页签下的文档（project_prds）。projectId 可为 Studio id 或 PM slug。",
      inputSchema: {
        projectId: z.string().min(1).describe("Studio id 或 PM slug"),
        limit: z.number().int().min(1).max(500).optional(),
      },
    },
    async (input) => {
      try {
        const { resolvePmProject } = await import("@/lib/bugs/resolve-pm");
        const { listProjectPrds } = await import("@/lib/prds/store");
        const { pm } = await resolvePmProject(input.projectId);
        if (!pm) return mcpError(`找不到 PM 项目：${input.projectId}`);
        const all = await listProjectPrds(pm.id);
        const limit = input.limit ?? 200;
        const rows = all.slice(0, limit).map(slimPrd);
        await logAiAction({
          action: "list_prds",
          payload: { projectId: pm.id, count: all.length },
        });
        return mcpJson({
          ok: true,
          projectId: pm.id,
          pmSlug: pm.slug,
          count: all.length,
          returned: rows.length,
          prds: rows,
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "list_prds 失败"
        );
      }
    }
  );

  server.registerTool(
    "create_prd",
    {
      title: "Create PRD",
      description:
        "在项目「PRD」页签新建一篇文档（写入 project_prds，不是 Wiki）。可传 markdown（自动转 HTML 大纲）或 htmlContent；modulePath 用于左侧板块分组。",
      inputSchema: {
        projectId: z.string().min(1).describe("Studio id 或 PM slug"),
        title: z.string().min(1),
        modulePath: z
          .string()
          .nullable()
          .optional()
          .describe("板块路径，如 APP重构1.0（纯视觉）；空则进未分配板块"),
        markdown: z
          .string()
          .optional()
          .describe("Markdown 正文；与 htmlContent 二选一，优先 markdown"),
        htmlContent: z.string().optional().describe("已是 HTML 时直接写入"),
      },
    },
    async (input) => {
      try {
        const { resolvePmProject } = await import("@/lib/bugs/resolve-pm");
        const { createProjectPrd } = await import("@/lib/prds/store");
        const { previewPrdImport } = await import("@/lib/prds/import-text");

        const { pm } = await resolvePmProject(input.projectId);
        if (!pm) return mcpError(`找不到 PM 项目：${input.projectId}`);

        let html = input.htmlContent?.trim() || "";
        let outlineCount = 0;
        let format: string | undefined;
        if (input.markdown?.trim()) {
          const preview = previewPrdImport(input.markdown, {
            titleHint: input.title,
          });
          html = preview.html;
          outlineCount = preview.outline.length;
          format = preview.format;
        }
        if (!html) {
          return mcpError("请提供 markdown 或 htmlContent");
        }

        const row = await createProjectPrd({
          project_id: pm.id,
          title: input.title.trim(),
          module_path: input.modulePath?.trim() || null,
          html_content: html,
        });

        await logAiAction({
          action: "create_prd",
          payload: {
            projectId: pm.id,
            prdId: row.id,
            title: row.title,
            modulePath: row.module_path,
            outlineCount,
            format: format ?? "html",
          },
        });

        return mcpJson({
          ok: true,
          projectId: pm.id,
          pmSlug: pm.slug,
          prd: slimPrd(row),
          outlineCount,
          format: format ?? "html",
          hint: `站内打开：/projects/${pm.slug}/prd（左侧列表点开「${row.title}」）`,
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "create_prd 失败"
        );
      }
    }
  );

  server.registerTool(
    "update_prd",
    {
      title: "Update PRD",
      description:
        "更新「PRD」页签文档的标题 / 板块 / 正文。markdown 会转 HTML 后覆盖 html_content。",
      inputSchema: {
        prdId: z.string().min(1),
        title: z.string().optional(),
        modulePath: z.string().nullable().optional(),
        markdown: z.string().optional(),
        htmlContent: z.string().optional(),
      },
    },
    async (input) => {
      try {
        const { updateProjectPrd, getPrdById } = await import(
          "@/lib/prds/store"
        );
        const { previewPrdImport } = await import("@/lib/prds/import-text");

        const existing = await getPrdById(input.prdId);
        if (!existing) return mcpError(`PRD 不存在：${input.prdId}`);

        let htmlContent = input.htmlContent;
        if (input.markdown?.trim()) {
          htmlContent = previewPrdImport(input.markdown, {
            titleHint: input.title || existing.title,
          }).html;
        }

        const row = await updateProjectPrd(input.prdId, {
          title: input.title,
          module_path: input.modulePath,
          html_content: htmlContent,
        });

        await logAiAction({
          action: "update_prd",
          payload: { prdId: row.id, title: row.title },
        });

        return mcpJson({ ok: true, prd: slimPrd(row) });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "update_prd 失败"
        );
      }
    }
  );

  server.registerTool(
    "delete_prd",
    {
      title: "Delete PRD",
      description:
        "删除「PRD」页签中的一篇文档（project_prds + 其评论）。不可恢复，请确认 title/id。",
      inputSchema: {
        prdId: z.string().min(1),
      },
    },
    async (input) => {
      try {
        const { getPrdById, deleteProjectPrd } = await import(
          "@/lib/prds/store"
        );
        const existing = await getPrdById(input.prdId);
        if (!existing) return mcpError(`PRD 不存在：${input.prdId}`);
        await deleteProjectPrd(input.prdId);
        await logAiAction({
          action: "delete_prd",
          payload: {
            prdId: input.prdId,
            title: existing.title,
            projectId: existing.project_id,
          },
        });
        return mcpJson({
          ok: true,
          deletedId: input.prdId,
          title: existing.title,
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "delete_prd 失败"
        );
      }
    }
  );
}
