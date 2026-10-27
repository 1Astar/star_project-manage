import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logAiAction } from "@/lib/mcp/action-log";
import { mcpError, mcpJson } from "@/lib/mcp/response";
import type { WikiPageHostKind } from "@/lib/types";

const hostKindSchema = z.enum([
  "module",
  "requirement",
  "bug",
  "learning",
  "prd",
  "competitor",
]);

function slimWikiPage(p: {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  body: string;
  sort_order: number;
  host_kind: WikiPageHostKind;
  host_key: string;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: p.id,
    projectId: p.project_id,
    parentId: p.parent_id,
    title: p.title,
    body: p.body,
    sortOrder: p.sort_order,
    hostKind: p.host_kind,
    hostKey: p.host_key,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

/**
 * Notion 风 Wiki 页树 MCP：list / get / create / update。
 * 挂载：hostKind+hostKey（模块名或实体 id）；子页用 parentId。
 */
export function registerWikiPageTools(server: McpServer) {
  server.registerTool(
    "list_wiki_pages",
    {
      title: "List Wiki Pages",
      description:
        "列出项目 Wiki 子页。可按 hostKind+hostKey 过滤（如 module+文件管理），parentId 为空只看根页、有值看某页的直接子页；都不传则返回该项目全部页。",
      inputSchema: {
        projectId: z.string().min(1).describe("Studio id 或 PM slug"),
        hostKind: hostKindSchema.optional(),
        hostKey: z
          .string()
          .optional()
          .describe("module=模块名；其余=实体 id"),
        parentId: z
          .string()
          .nullable()
          .optional()
          .describe("null/省略：不过滤父级；传空字符串等同根页(parent=null)"),
        limit: z.number().int().min(1).max(500).optional(),
      },
    },
    async (input) => {
      try {
        const { resolvePmProject } = await import("@/lib/bugs/resolve-pm");
        const {
          listProjectWikiPages,
          listWikiPagesByHost,
        } = await import("@/lib/wiki-pages/store");

        const { pm } = await resolvePmProject(input.projectId);
        if (!pm) return mcpError(`找不到 PM 项目：${input.projectId}`);

        const limit = input.limit ?? 200;
        let pages;
        if (input.hostKind && input.hostKey?.trim()) {
          const parentRaw = input.parentId;
          const parentId =
            parentRaw === undefined
              ? undefined
              : parentRaw === null || String(parentRaw).trim() === ""
                ? null
                : String(parentRaw).trim();
          pages = await listWikiPagesByHost({
            projectId: pm.id,
            hostKind: input.hostKind,
            hostKey: input.hostKey.trim(),
            parentId,
          });
        } else {
          pages = await listProjectWikiPages(pm.id);
          if (input.hostKind) {
            pages = pages.filter((p) => p.host_kind === input.hostKind);
          }
          if (input.hostKey?.trim()) {
            const key = input.hostKey.trim();
            pages = pages.filter((p) => p.host_key === key);
          }
          if (input.parentId !== undefined) {
            const want =
              input.parentId === null || String(input.parentId).trim() === ""
                ? null
                : String(input.parentId).trim();
            pages = pages.filter((p) => (p.parent_id ?? null) === want);
          }
        }

        const slim = pages.slice(0, limit).map(slimWikiPage);
        await logAiAction({
          action: "list_wiki_pages",
          payload: {
            projectId: pm.id,
            count: pages.length,
            hostKind: input.hostKind ?? null,
            hostKey: input.hostKey ?? null,
          },
        });
        return mcpJson({
          ok: true,
          projectId: pm.id,
          pmSlug: pm.slug,
          count: pages.length,
          returned: slim.length,
          pages: slim,
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "list_wiki_pages 失败"
        );
      }
    }
  );

  server.registerTool(
    "get_wiki_page",
    {
      title: "Get Wiki Page",
      description: "读取单个 Wiki 页（含正文），并返回祖先面包屑与直接子页摘要。",
      inputSchema: {
        pageId: z.string().min(1),
      },
    },
    async (input) => {
      try {
        const {
          getWikiPage,
          getWikiPageAncestors,
          listWikiPagesByHost,
        } = await import("@/lib/wiki-pages/store");

        const page = await getWikiPage(input.pageId);
        if (!page) return mcpError(`页面不存在：${input.pageId}`);

        const [ancestors, children] = await Promise.all([
          getWikiPageAncestors(page.id),
          listWikiPagesByHost({
            projectId: page.project_id,
            hostKind: page.host_kind,
            hostKey: page.host_key,
            parentId: page.id,
          }),
        ]);

        await logAiAction({
          action: "get_wiki_page",
          payload: { pageId: page.id, projectId: page.project_id },
        });

        return mcpJson({
          ok: true,
          page: slimWikiPage(page),
          ancestors: ancestors.map((a) => ({
            id: a.id,
            title: a.title,
            parentId: a.parent_id,
          })),
          children: children.map((c) => ({
            id: c.id,
            title: c.title,
            sortOrder: c.sort_order,
          })),
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "get_wiki_page 失败"
        );
      }
    }
  );

  server.registerTool(
    "create_wiki_page",
    {
      title: "Create Wiki Page",
      description:
        "创建 Wiki 页并挂载。根页：hostKind+hostKey（如 module+文件管理），parentId 空；子页：传 parentId（自动继承父页挂载）。用于搭模块功能拆解框架。",
      inputSchema: {
        projectId: z.string().min(1).describe("Studio id 或 PM slug"),
        title: z.string().min(1),
        body: z.string().optional().describe("Markdown 正文"),
        hostKind: hostKindSchema
          .optional()
          .describe("有 parentId 时可省略（继承父页）"),
        hostKey: z
          .string()
          .optional()
          .describe("有 parentId 时可省略；module 时为模块名"),
        parentId: z.string().nullable().optional(),
      },
    },
    async (input) => {
      try {
        const { resolvePmProject } = await import("@/lib/bugs/resolve-pm");
        const { createWikiPage, getWikiPage } = await import(
          "@/lib/wiki-pages/store"
        );

        const { pm } = await resolvePmProject(input.projectId);
        if (!pm) return mcpError(`找不到 PM 项目：${input.projectId}`);

        const parentId =
          input.parentId && String(input.parentId).trim()
            ? String(input.parentId).trim()
            : null;

        let hostKind = input.hostKind;
        let hostKey = input.hostKey?.trim() ?? "";

        if (parentId) {
          const parent = await getWikiPage(parentId);
          if (!parent) return mcpError(`父页面不存在：${parentId}`);
          if (parent.project_id !== pm.id) {
            return mcpError("父页面不属于本项目");
          }
          hostKind = parent.host_kind;
          hostKey = parent.host_key;
        } else {
          if (!hostKind) {
            return mcpError("创建根页须提供 hostKind（如 module）");
          }
          if (!hostKey) {
            return mcpError(
              hostKind === "module"
                ? "创建模块根页须提供 hostKey=模块名（如 文件管理）"
                : "创建根页须提供 hostKey=实体 id"
            );
          }
        }

        const page = await createWikiPage({
          project_id: pm.id,
          title: input.title,
          body: input.body,
          parent_id: parentId,
          host_kind: hostKind!,
          host_key: hostKey,
        });

        await logAiAction({
          action: "create_wiki_page",
          payload: {
            pageId: page.id,
            projectId: pm.id,
            title: page.title,
            hostKind: page.host_kind,
            hostKey: page.host_key,
            parentId: page.parent_id,
          },
        });

        return mcpJson({
          ok: true,
          page: slimWikiPage(page),
          pmSlug: pm.slug,
          hint:
            page.host_kind === "module"
              ? `站内打开：/projects/${pm.slug}/modules/${encodeURIComponent(page.host_key)} 或 /projects/${pm.slug}/pages/${page.id}`
              : `站内打开：/projects/${pm.slug}/pages/${page.id}`,
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "create_wiki_page 失败"
        );
      }
    }
  );

  server.registerTool(
    "update_wiki_page",
    {
      title: "Update Wiki Page",
      description:
        "更新 Wiki 页标题/正文/排序，或改挂父页（parentId）。改挂后 host 继承新父页；parentId=null 升为宿主根页（保持原 host）。",
      inputSchema: {
        pageId: z.string().min(1),
        title: z.string().optional(),
        body: z.string().optional(),
        parentId: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
      },
    },
    async (input) => {
      try {
        const { updateWikiPage, getWikiPage } = await import(
          "@/lib/wiki-pages/store"
        );

        const existing = await getWikiPage(input.pageId);
        if (!existing) return mcpError(`页面不存在：${input.pageId}`);

        if (
          input.title === undefined &&
          input.body === undefined &&
          input.parentId === undefined &&
          input.sortOrder === undefined
        ) {
          return mcpError("至少提供 title / body / parentId / sortOrder 之一");
        }

        const page = await updateWikiPage(input.pageId, {
          title: input.title,
          body: input.body,
          parent_id: input.parentId,
          sort_order: input.sortOrder,
        });

        await logAiAction({
          action: "update_wiki_page",
          payload: {
            pageId: page.id,
            projectId: page.project_id,
            title: page.title,
          },
        });

        return mcpJson({ ok: true, page: slimWikiPage(page) });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "update_wiki_page 失败"
        );
      }
    }
  );
}
