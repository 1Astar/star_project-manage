import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logAiAction } from "@/lib/mcp/action-log";
import { mcpError, mcpJson } from "@/lib/mcp/response";
import type { LearningNoteKind } from "@/lib/types";

const kindSchema = z.enum(["section", "topic", "point"]);

function titleKey(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export type LearningImportItem = {
  title: string;
  section?: string;
  topic?: string;
  principle?: string;
  whyText?: string;
  source?: string;
  protocol?: string;
  techBackground?: string;
  competitors?: string;
  productThinking?: string;
};

export async function importLearningNotesBatch(
  projectId: string,
  notes: LearningImportItem[]
): Promise<{
  created: { section: number; topic: number; point: number };
  skipped: string[];
  points: Array<{ title: string; id: string }>;
}> {
  const {
    createProjectLearningNote,
    listProjectLearningNotes,
  } = await import("@/lib/learning-notes/store");

  let all = await listProjectLearningNotes(projectId);
  const sectionBy = new Map<string, string>();
  for (const n of all) {
    if (n.kind === "section") sectionBy.set(titleKey(n.title), n.id);
  }

  const created = { section: 0, topic: 0, point: 0 };
  const skipped: string[] = [];
  const pointIds: Array<{ title: string; id: string }> = [];

  async function ensureSection(name: string): Promise<string | null> {
    const t = name.trim();
    if (!t) return null;
    const key = titleKey(t);
    const hit = sectionBy.get(key);
    if (hit) return hit;
    const existing = all.find(
      (n) => n.kind === "section" && titleKey(n.title) === key
    );
    if (existing) {
      sectionBy.set(key, existing.id);
      return existing.id;
    }
    const row = await createProjectLearningNote({
      project_id: projectId,
      title: t,
      kind: "section",
      parent_id: null,
    });
    sectionBy.set(key, row.id);
    all = [...all, row];
    created.section += 1;
    return row.id;
  }

  async function ensureTopic(
    name: string,
    sectionId: string | null
  ): Promise<string> {
    const t = name.trim() || "未分主题";
    const key = titleKey(t);
    const existing = all.find(
      (n) =>
        n.kind === "topic" &&
        titleKey(n.title) === key &&
        (sectionId ? n.parent_id === sectionId : true)
    );
    if (existing) return existing.id;
    const row = await createProjectLearningNote({
      project_id: projectId,
      title: t,
      kind: "topic",
      parent_id: sectionId,
    });
    all = [...all, row];
    created.topic += 1;
    return row.id;
  }

  for (const item of notes) {
    const sectionId = item.section ? await ensureSection(item.section) : null;
    const topicName = (item.topic || item.title).trim();
    const topicId = await ensureTopic(topicName, sectionId);
    const pointTitle = item.title.trim();
    const existingPoint = all.find(
      (n) =>
        n.kind === "point" &&
        n.parent_id === topicId &&
        titleKey(n.title) === titleKey(pointTitle)
    );
    if (existingPoint) {
      skipped.push(pointTitle);
      pointIds.push({ title: pointTitle, id: existingPoint.id });
      continue;
    }
    const whyParts = [
      item.whyText?.trim() || "",
      item.source?.trim() ? `出处：${item.source.trim()}` : "",
    ].filter(Boolean);
    const row = await createProjectLearningNote({
      project_id: projectId,
      title: pointTitle,
      kind: "point",
      parent_id: topicId,
      why_text: whyParts.join("\n"),
      principle: item.principle,
      protocol: item.protocol,
      tech_background: item.techBackground,
      competitors: item.competitors,
      product_thinking: item.productThinking,
    });
    all = [...all, row];
    created.point += 1;
    pointIds.push({ title: pointTitle, id: row.id });
  }

  return { created, skipped, points: pointIds };
}

export function registerLearningTools(server: McpServer) {
  server.registerTool(
    "list_learning_notes",
    {
      title: "List Learning Notes",
      description:
        "列出项目学习池笔记（板块/主题/子知识点）。可按 kind、parentId 过滤。",
      inputSchema: {
        projectId: z.string().min(1).describe("Studio 项目 id，如 proj-e82afb1a"),
        kind: kindSchema.optional(),
        parentId: z
          .string()
          .nullable()
          .optional()
          .describe("只看某父节点下；null=仅根级板块"),
        limit: z.number().int().min(1).max(500).optional(),
      },
    },
    async (input) => {
      try {
        const { listProjectLearningNotes } = await import(
          "@/lib/learning-notes/store"
        );
        let notes = await listProjectLearningNotes(input.projectId);
        if (input.kind) notes = notes.filter((n) => n.kind === input.kind);
        if (input.parentId !== undefined) {
          notes = notes.filter((n) =>
            input.parentId === null
              ? n.parent_id == null
              : n.parent_id === input.parentId
          );
        }
        const limit = input.limit ?? 200;
        const sliced = notes.slice(0, limit);
        await logAiAction({
          action: "list_learning_notes",
          payload: { projectId: input.projectId, count: sliced.length },
        });
        return mcpJson({
          ok: true,
          count: notes.length,
          returned: sliced.length,
          notes: sliced.map((n) => ({
            id: n.id,
            title: n.title,
            kind: n.kind,
            parentId: n.parent_id,
            principle: (n.principle || "").slice(0, 200),
            updatedAt: n.updated_at,
          })),
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "list_learning_notes 失败"
        );
      }
    }
  );

  server.registerTool(
    "create_learning_note",
    {
      title: "Create Learning Note",
      description:
        "创建学习池笔记。kind=section 板块（无父）/ topic 主题（挂板块）/ point 子知识点（挂主题）。",
      inputSchema: {
        projectId: z.string().min(1),
        title: z.string().min(1),
        kind: kindSchema.optional().describe("默认 topic"),
        parentId: z.string().nullable().optional(),
        whyText: z.string().optional(),
        principle: z.string().optional(),
        protocol: z.string().optional(),
        techBackground: z.string().optional(),
        competitors: z.string().optional(),
        productThinking: z.string().optional(),
      },
    },
    async (input) => {
      try {
        const { createProjectLearningNote } = await import(
          "@/lib/learning-notes/store"
        );
        const note = await createProjectLearningNote({
          project_id: input.projectId,
          title: input.title,
          kind: (input.kind as LearningNoteKind | undefined) ?? "topic",
          parent_id: input.parentId,
          why_text: input.whyText,
          principle: input.principle,
          protocol: input.protocol,
          tech_background: input.techBackground,
          competitors: input.competitors,
          product_thinking: input.productThinking,
        });
        await logAiAction({
          action: "create_learning_note",
          payload: { projectId: input.projectId, noteId: note.id, kind: note.kind },
        });
        return mcpJson({ ok: true, note });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "create_learning_note 失败"
        );
      }
    }
  );

  server.registerTool(
    "import_learning_notes",
    {
      title: "Import Learning Notes",
      description:
        "批量灌入学习池：按 section→topic→point 建树；同名板块/主题复用；同主题下同名子知识点跳过。适合 Excel 知识表。",
      inputSchema: {
        projectId: z.string().min(1),
        notes: z
          .array(
            z.object({
              title: z.string().min(1).describe("子知识点标题；无分层时也可作主题名"),
              section: z.string().optional().describe("板块"),
              topic: z.string().optional().describe("主题；缺省用 title"),
              principle: z.string().optional(),
              whyText: z.string().optional(),
              source: z.string().optional().describe("写入 whyText 后缀出处"),
              protocol: z.string().optional(),
              techBackground: z.string().optional(),
              competitors: z.string().optional(),
              productThinking: z.string().optional(),
            })
          )
          .min(1)
          .max(200),
      },
    },
    async (input) => {
      try {
        const result = await importLearningNotesBatch(
          input.projectId,
          input.notes
        );
        await logAiAction({
          action: "import_learning_notes",
          payload: {
            projectId: input.projectId,
            created: result.created,
            skipped: result.skipped.length,
          },
        });
        return mcpJson({
          ok: true,
          created: result.created,
          skipped: result.skipped,
          points: result.points,
        });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "import_learning_notes 失败"
        );
      }
    }
  );

  server.registerTool(
    "attach_learning_image",
    {
      title: "Attach Learning Image",
      description: "给学习池笔记挂图。传 base64 或 url。",
      inputSchema: {
        noteId: z.string().min(1),
        title: z.string().optional(),
        url: z.string().optional(),
        fileName: z.string().optional(),
        mimeType: z.string().optional(),
        base64: z.string().optional(),
      },
    },
    async (input) => {
      try {
        const {
          getLearningNoteById,
          createLearningNoteAttachment,
        } = await import("@/lib/learning-notes/store");
        const note = await getLearningNoteById(input.noteId);
        if (!note) return mcpError("学习笔记不存在");
        let url = input.url?.trim() || "";
        let storagePath: string | null = null;
        let mimeType = input.mimeType ?? null;
        if (!url && input.base64?.trim()) {
          const { uploadStudioAssetFile } = await import(
            "@/lib/studio/asset-storage"
          );
          const raw = input.base64.replace(/^data:[^;]+;base64,/, "");
          const buf = Buffer.from(raw, "base64");
          const name =
            input.fileName?.trim() || `${input.title ?? "learning"}.png`;
          const file = new File([buf], name, {
            type: mimeType || "image/png",
          });
          const uploaded = await uploadStudioAssetFile(note.project_id, file);
          url = uploaded.url;
          storagePath = uploaded.storagePath;
          mimeType = uploaded.mimeType;
        }
        if (!url) return mcpError("请提供 url 或 base64");
        const attachment = await createLearningNoteAttachment({
          project_id: note.project_id,
          note_id: note.id,
          title: input.title?.trim() || input.fileName || "截图",
          url,
          storage_path: storagePath,
          mime_type: mimeType,
        });
        await logAiAction({
          action: "attach_learning_image",
          payload: { noteId: note.id, attachmentId: attachment.id },
        });
        return mcpJson({ ok: true, attachment });
      } catch (error) {
        return mcpError(
          error instanceof Error ? error.message : "attach_learning_image 失败"
        );
      }
    }
  );
}
