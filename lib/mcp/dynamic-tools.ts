/**
 * 动态 MCP 工具：落盘 registry + 启动时加载。
 * 元工具 add_mcp_tool / list / disable；本期不热挂。
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mcpError, mcpJson } from "@/lib/mcp/response";

const ROOT = () => path.join(process.cwd(), "lib", "mcp", "dynamic-tools");
const REGISTRY_PATH = () => path.join(ROOT(), "registry.json");

export type DynamicToolMeta = {
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  module?: string;
  createdAt: string;
  updatedAt: string;
  handlerSketch?: string;
};

export type DynamicRegistry = {
  version: 1;
  tools: DynamicToolMeta[];
};

/** 禁止覆盖的内置工具名（与 registerStarPmTools / workspace-tools 对齐，增工具时请补） */
export const BUILTIN_MCP_TOOL_NAMES = new Set([
  "capture_idea",
  "search",
  "get_idea",
  "list_ideas",
  "update_idea",
  "list_projects",
  "create_project",
  "update_project",
  "convert_idea",
  "list_tasks",
  "create_task",
  "update_task",
  "delete_task",
  "list_tables",
  "describe_table",
  "create_table",
  "add_column",
  "create_index",
  "get_ai_rules",
  "add_evolution",
  "add_decision",
  "list_evolution",
  "publish_release",
  "suggest_shipped_from_release",
  "confirm_shipped_requirements",
  "list_git_sync_suggestions",
  "confirm_git_sync_suggestions",
  "start_change_session",
  "finish_change_session",
  "update_change_session",
  "list_change_sessions",
  "get_change_session",
  "create_requirement",
  "update_requirement",
  "list_requirements",
  "create_bug",
  "update_bug",
  "update_bugs",
  "list_bugs",
  "get_bug",
  "delete_bug",
  "add_bug_comment",
  "create_interview",
  "update_interview",
  "list_interviews",
  "link_interview_requirement",
  "organize_star_pm_req_tree",
  "align_project_periods",
  "create_planning_iteration",
  "update_planning_iteration",
  "list_iterations",
  "summarize_day",
  "summarize_project",
  "generate_brief",
  "link_item",
  "import_changelog_evolution",
  "send_test_push",
  "add_mcp_tool",
  "list_dynamic_mcp_tools",
  "disable_mcp_tool",
]);

const NAME_RE = /^[a-z][a-z0-9_]{1,63}$/;

export function assertValidToolName(name: string): string {
  const n = name.trim();
  if (!NAME_RE.test(n)) {
    throw new Error(
      "工具名须 snake_case：小写字母开头，仅 a-z0-9_，长度 2～64"
    );
  }
  if (BUILTIN_MCP_TOOL_NAMES.has(n)) {
    throw new Error(`禁止覆盖内置工具：${n}`);
  }
  if (n.startsWith("dynamic_meta_")) {
    throw new Error("dynamic_meta_* 为保留前缀");
  }
  return n;
}

function ensureRoot() {
  const root = ROOT();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  if (!fs.existsSync(REGISTRY_PATH())) {
    const empty: DynamicRegistry = { version: 1, tools: [] };
    fs.writeFileSync(REGISTRY_PATH(), JSON.stringify(empty, null, 2), "utf8");
  }
  return root;
}

export function readDynamicRegistry(): DynamicRegistry {
  ensureRoot();
  try {
    const raw = fs.readFileSync(REGISTRY_PATH(), "utf8");
    const parsed = JSON.parse(raw) as DynamicRegistry;
    if (!parsed?.tools || !Array.isArray(parsed.tools)) {
      return { version: 1, tools: [] };
    }
    return { version: 1, tools: parsed.tools };
  } catch {
    return { version: 1, tools: [] };
  }
}

function writeDynamicRegistry(reg: DynamicRegistry) {
  ensureRoot();
  fs.writeFileSync(REGISTRY_PATH(), JSON.stringify(reg, null, 2), "utf8");
}

export type JsonSchemaLite = {
  type?: string;
  properties?: Record<
    string,
    { type?: string; description?: string; items?: { type?: string } }
  >;
  required?: string[];
};

/** 简易 JSON Schema → Zod（仅 string/number/boolean/string[]） */
export function jsonSchemaLiteToZod(
  schema: JsonSchemaLite | null | undefined
): z.ZodRawShape {
  const shape: z.ZodRawShape = {};
  const props = schema?.properties ?? {};
  const required = new Set(schema?.required ?? []);
  for (const [key, prop] of Object.entries(props)) {
    let field: z.ZodTypeAny;
    switch (prop.type) {
      case "number":
      case "integer":
        field = z.number();
        break;
      case "boolean":
        field = z.boolean();
        break;
      case "array":
        field = z.array(z.string());
        break;
      default:
        field = z.string();
    }
    if (prop.description) field = field.describe(prop.description);
    if (!required.has(key)) field = field.optional();
    shape[key] = field;
  }
  return shape;
}

function toolDir(name: string) {
  return path.join(ROOT(), name);
}

function scaffoldHandlerTs(meta: {
  name: string;
  title: string;
  handlerSketch: string;
}): string {
  const sketch = meta.handlerSketch.replace(/\*\//g, "* /");
  return `/**
 * 动态工具：${meta.title}（${meta.name}）
 * 由 add_mcp_tool 生成。补全 handle 后重启/重连 MCP 生效。
 *
 * 【sketch】
 * ${sketch.split("\n").join("\n * ")}
 *
 * 允许 import：@/lib/studio/*、@/lib/db/*、@/lib/mcp/response、@/lib/project-bridge
 * 禁止：eval、子进程、读 .env / 密钥文件、任意网络（除非走已有 lib）
 */
import { mcpError, mcpJson } from "@/lib/mcp/response";

export async function handle(
  args: Record<string, unknown>
): Promise<ReturnType<typeof mcpJson> | ReturnType<typeof mcpError>> {
  void args;
  return mcpError(
    "动态工具 ${meta.name} 尚未实现：请按 handler.ts 顶部 sketch 补全 handle()，然后重启 MCP。"
  );
}
`;
}

function scaffoldToolJson(meta: DynamicToolMeta, inputSchema: JsonSchemaLite) {
  return {
    ...meta,
    inputSchema,
  };
}

export type AddMcpToolInput = {
  name: string;
  title: string;
  description: string;
  inputSchema?: JsonSchemaLite;
  handlerSketch: string;
  module?: string;
  /** 已存在时覆盖骨架（默认 false） */
  overwrite?: boolean;
};

export function addMcpToolToDisk(input: AddMcpToolInput): {
  meta: DynamicToolMeta;
  paths: { dir: string; toolJson: string; handler: string; registry: string };
  nextStep: string;
} {
  const name = assertValidToolName(input.name);
  ensureRoot();
  const dir = toolDir(name);
  const toolJsonPath = path.join(dir, "tool.json");
  const handlerPath = path.join(dir, "handler.ts");
  const exists = fs.existsSync(dir);

  if (exists && !input.overwrite) {
    throw new Error(
      `工具 ${name} 已存在。若要重写骨架传 overwrite:true（会覆盖 handler.ts / tool.json）。`
    );
  }

  const now = new Date().toISOString();
  const reg = readDynamicRegistry();
  const prev = reg.tools.find((t) => t.name === name);
  const meta: DynamicToolMeta = {
    name,
    title: input.title.trim() || name,
    description: input.description.trim() || input.title,
    enabled: prev?.enabled ?? true,
    module: input.module?.trim() || "MCP·动态工具",
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    handlerSketch: input.handlerSketch.trim(),
  };

  fs.mkdirSync(dir, { recursive: true });
  const schema = input.inputSchema ?? { type: "object", properties: {} };
  fs.writeFileSync(
    toolJsonPath,
    JSON.stringify(scaffoldToolJson(meta, schema), null, 2),
    "utf8"
  );
  fs.writeFileSync(
    handlerPath,
    scaffoldHandlerTs({
      name,
      title: meta.title,
      handlerSketch: meta.handlerSketch || "(无 sketch)",
    }),
    "utf8"
  );

  reg.tools = reg.tools.filter((t) => t.name !== name);
  reg.tools.push(meta);
  reg.tools.sort((a, b) => a.name.localeCompare(b.name));
  writeDynamicRegistry(reg);

  return {
    meta,
    paths: {
      dir,
      toolJson: toolJsonPath,
      handler: handlerPath,
      registry: REGISTRY_PATH(),
    },
    nextStep:
      "1) 编辑 handler.ts 实现 handle()  2) 重启或重连 Cursor 的 user-star-pm MCP  3) 新工具才会出现在工具列表。本期不热挂。",
  };
}

export function listDynamicMcpToolsFromDisk(): DynamicToolMeta[] {
  return readDynamicRegistry().tools.slice();
}

export function disableMcpToolOnDisk(name: string, enabled = false): DynamicToolMeta {
  const n = name.trim();
  const reg = readDynamicRegistry();
  const idx = reg.tools.findIndex((t) => t.name === n);
  if (idx < 0) throw new Error(`动态工具不存在：${n}`);
  const updated: DynamicToolMeta = {
    ...reg.tools[idx]!,
    enabled,
    updatedAt: new Date().toISOString(),
  };
  reg.tools[idx] = updated;
  writeDynamicRegistry(reg);

  const toolJsonPath = path.join(toolDir(n), "tool.json");
  if (fs.existsSync(toolJsonPath)) {
    try {
      const tj = JSON.parse(fs.readFileSync(toolJsonPath, "utf8")) as Record<
        string,
        unknown
      >;
      tj.enabled = enabled;
      tj.updatedAt = updated.updatedAt;
      fs.writeFileSync(toolJsonPath, JSON.stringify(tj, null, 2), "utf8");
    } catch {
      /* ignore */
    }
  }
  return updated;
}

type HandlerMod = {
  handle?: (
    args: Record<string, unknown>
  ) => Promise<ReturnType<typeof mcpJson> | ReturnType<typeof mcpError>>;
};

async function loadHandlerModule(handlerPath: string): Promise<HandlerMod> {
  try {
    const { pathToFileURL } = await import("node:url");
    const href = pathToFileURL(path.resolve(handlerPath)).href;
    return (await import(href)) as HandlerMod;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      handle: async () =>
        mcpError(
          `无法加载动态 handler（常见于边缘/打包环境；请用本地 mcp:stdio）：${msg}`
        ),
    };
  }
}

/**
 * 启动时注册已启用的动态工具。
 */
export async function registerDynamicMcpTools(server: McpServer): Promise<{
  loaded: string[];
  skipped: string[];
  errors: Array<{ name: string; error: string }>;
}> {
  ensureRoot();
  const reg = readDynamicRegistry();
  const loaded: string[] = [];
  const skipped: string[] = [];
  const errors: Array<{ name: string; error: string }> = [];

  for (const meta of reg.tools) {
    if (!meta.enabled) {
      skipped.push(meta.name);
      continue;
    }
    if (BUILTIN_MCP_TOOL_NAMES.has(meta.name)) {
      skipped.push(meta.name);
      continue;
    }

    const dir = toolDir(meta.name);
    const toolJsonPath = path.join(dir, "tool.json");
    const handlerPath = path.join(dir, "handler.ts");
    if (!fs.existsSync(handlerPath)) {
      errors.push({ name: meta.name, error: "缺少 handler.ts" });
      continue;
    }

    let inputSchema: JsonSchemaLite = { type: "object", properties: {} };
    const metaCopy = { ...meta };
    if (fs.existsSync(toolJsonPath)) {
      try {
        const tj = JSON.parse(fs.readFileSync(toolJsonPath, "utf8")) as {
          inputSchema?: JsonSchemaLite;
          description?: string;
          title?: string;
        };
        if (tj.inputSchema) inputSchema = tj.inputSchema;
        if (tj.description) metaCopy.description = tj.description;
        if (tj.title) metaCopy.title = tj.title;
      } catch (e) {
        errors.push({
          name: meta.name,
          error: e instanceof Error ? e.message : "tool.json 解析失败",
        });
        continue;
      }
    }

    const shape = jsonSchemaLiteToZod(inputSchema);

    server.registerTool(
      metaCopy.name,
      {
        title: metaCopy.title,
        description: `[动态] ${metaCopy.description}`,
        inputSchema: shape,
      },
      async (args) => {
        try {
          const mod = await loadHandlerModule(handlerPath);
          if (typeof mod.handle !== "function") {
            return mcpError(`动态工具 ${metaCopy.name} 未导出 handle()`);
          }
          return await mod.handle(args as Record<string, unknown>);
        } catch (e) {
          return mcpError(
            e instanceof Error
              ? `动态工具 ${metaCopy.name} 执行失败：${e.message}`
              : `动态工具 ${metaCopy.name} 执行失败`
          );
        }
      }
    );
    loaded.push(metaCopy.name);
  }

  return { loaded, skipped, errors };
}

/** 延期范围说明（与 PM Idea 同步；防双盲） */
export const DYNAMIC_MCP_DEFER_SCOPE = {
  shipped: "B：add_mcp_tool / list_dynamic_mcp_tools / disable_mcp_tool + 启动加载落盘工具",
  deferred: [
    {
      id: "defer-hot-register",
      title: "运行时热挂 + list_changed 通知",
      card: `【是什么】add_mcp_tool 成功后当场 server.registerTool，并向客户端发 notifications/tools/list_changed，无需重启即可看见新工具。
【为什么本期不做】Cursor 对 list_changed 支持不稳定；热挂任意 handler 风险高；先验证落盘流程。
【前期已落地】落盘 registry + 启动 registerDynamicMcpTools。
【后期怎么做】① confirm 客户端支持 list_changed；② add 后动态 import handler 并 registerTool；③ 发 list_changed；④ 验收：同会话内 tools/list 出现新名且可调用。
【不做混淆项】不是改 Cursor 插件；不是热改内置工具实现。
【触发重开】用户明确要「加完立刻能调」且接受沙箱/白名单约束。
【同批兄弟】defer-sandbox-js、defer-edit-workspace-tools`,
    },
    {
      id: "defer-sandbox-js",
      title: "沙箱执行任意 JS 作为 handler",
      card: `【是什么】handlerSketch 可直接当可执行脚本在 docker/node 沙箱跑，真正「一句话造工具」。
【为什么本期不做】任意代码执行=密钥与数据面风险；需隔离与审计，超出本期安全边界。
【前期已落地】只生成 handler.ts 骨架，默认返回未实现错误。
【后期怎么做】参考 dynamic-mcp：隔离执行、超时、禁止读 env；白名单 API 注入；审计日志。验收：恶意 fs/env 访问被拒，合法只读查询可跑。
【不做混淆项】不是允许 eval 进主进程；不是放开网络爬虫。
【触发重开】有明确沙箱方案（Docker 或等价）且用户要「口头造工具即跑」。
【同批兄弟】defer-hot-register、defer-edit-workspace-tools`,
    },
    {
      id: "defer-edit-workspace-tools",
      title: "自动改写 workspace-tools.ts 大文件",
      card: `【是什么】把新工具直接插入 lib/mcp/workspace-tools.ts 成为「一等公民」源码，而非 dynamic-tools 目录。
【为什么本期不做】大文件冲突/评审成本高；动态目录已解耦发布与实验工具。
【前期已落地】独立目录 lib/mcp/dynamic-tools/<name>/。
【后期怎么做】codegen 到 workspace-tools 或拆 barrel export；PR 模板；禁止覆盖内置。验收：生成 diff 可审、CI 类型通过。
【不做混淆项】不是手工复制粘贴替代流程的唯一方式（人仍可手写内置工具）。
【触发重开】某动态工具稳定后要「转正」进主清单。
【同批兄弟】defer-hot-register、defer-sandbox-js`,
    },
  ],
} as const;
