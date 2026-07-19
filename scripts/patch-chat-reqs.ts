import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const text = readFileSync(resolve(".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    process.env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
  }
}

async function main() {
  loadEnv();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const now = new Date().toISOString();

  const patches: Array<{ id: string; note: string; patch: Record<string, unknown> }> = [
    {
      id: "6229bd38-ed04-4142-b4e9-ba988e70ba0b",
      note: "GPT Capture 需求对齐 DB-first",
      patch: {
        priority: "P0",
        status: "done",
        status_tags: ["完成"],
        // 提出日按聊天 2026-07-13；完成时间已有，保留
        submitted_at: "2026-07-13",
        completed_at: "2026-07-14T02:05:20.708+00:00",
        detail_work:
          "外部 ChatGPT/Action 调用 capture API 后直接写入 studio_ideas 收件箱（DB-first），返回 ideaId。\n\n" +
          "原始诉求：不要只建 GitHub Issue，提交后立刻出现在 Star PM。\n\n" +
          "决策（2026-07-13）：主路径 createStudioIdea；GitHub 同步降为可选/旁路。OpenAPI 见 scripts/chatgpt-ideas-capture.openapi.yaml。",
        acceptance_criteria:
          "1) POST /api/ideas/capture + 正确密钥 → 200 且含 ideaId\n" +
          "2) /inbox 或 /stream 立刻可见\n" +
          "3) 不再依赖「同步 GitHub 灵感」才能入库",
        next_step: "生产密钥回归 Custom GPT Action；确认响应字段为 ideaId。",
        inspiration_source: "ChatGPT · Cursor 会话 2026-07-13",
        req_source_note:
          "脑暴 2026-07-13 15:44 CST；完成批次 completed_at=2026-07-14T02:05:20Z（与 idea-806492e0 对齐）",
        studio_idea_id: "idea-806492e0",
        updated_at: now,
      },
    },
    {
      id: "3b327836-b8ec-439f-813f-5b7526558d69",
      note: "AI灵感捕获系统 — 部分完成（MCP/双路径已上，自动分类待做）",
      patch: {
        priority: "P0",
        status: "in_progress",
        status_tags: ["开发中"],
        submitted_at: "2026-07-13",
        detail_work:
          "让 Star PM 成为 AI 聊天产生灵感后的自动记忆系统。\n\n" +
          "已落地：DB-first capture；MCP 工具（含 capture_idea/create_task/convert_idea）；" +
          "Cursor Bearer /api/mcp + ChatGPT OAuth /api/mcp-oauth/mcp 双路径；生产域名 star-project-manage.vercel.app。\n\n" +
          "未完成：服务端自动分类/猜项目；识别规则与 analyze_idea。分类短期仍靠 GPT Instructions 填 type/relatedProjectId。",
        acceptance_criteria:
          "P0 已验收部分：多入口写入同一收件箱（Action/MCP/站内）。\n" +
          "剩余验收：未填 type 时服务端可合理分类；项目名可映射到 relatedProjectId。",
        next_step: "维护项目 ID 映射表 → 评估 analyze_idea 自动分类。",
        inspiration_source: "ChatGPT · Cursor 会话 2026-07-13～14",
        req_source_note:
          "边界讨论 2026-07-13 15:48；MCP 提出 15:54；OAuth 双路径 2026-07-14 09:22～09:38",
        studio_idea_id: "idea-714e39da",
        updated_at: now,
      },
    },
    {
      id: "90138a45-8f84-42c6-8a96-7c75705c205b",
      note: "项目灵感捕获 — 对齐默认关联当前项目",
      patch: {
        priority: "P1",
        status: "in_progress",
        status_tags: ["开发中"],
        submitted_at: "2026-07-13",
        detail_work:
          "让聊天产生的想法自动进入 Star PM 灵感池，并可关联当前项目。\n\n" +
          "基线入库（DB-first）已随 GPT Capture 完成；本条聚焦「关联项目」：relatedProjectId / 项目页 capture 默认当前项目 / GPT Instructions 映射。",
        acceptance_criteria:
          "1) 带 relatedProjectId 的 capture 正确挂接\n" +
          "2) 项目 tasks 页结构化捕获默认当前项目\n" +
          "3) GPT 可通过映射表写入正确项目 ID",
        next_step: "核对项目页 capture 默认项目；补齐 GPT 项目名→ID 映射。",
        inspiration_source: "ChatGPT · Cursor 会话",
        req_source_note: "与 idea-806492e0 / idea-714e39da 同会话；本条偏「挂项目」而非「仅入库」",
        updated_at: now,
      },
    },
    {
      id: "a2a1f45e-368a-4c7a-98bb-a58a47c77d60",
      note: "灵感捕获与整理域 — 备注本聊天关键决策",
      patch: {
        optimization_notes:
          "2026-07-13～14 关键决策：Capture DB-first；MCP 双路径（Bearer/OAuth）；域名锁定 star-project-manage。" +
          "子项 GPT Capture 已完成；AI灵感捕获系统进行中（自动分类未完）。",
        updated_at: now,
      },
    },
    {
      id: "4677037d-61fe-426a-8079-29cce7bdbcd1",
      note: "Git/部署域 — 备注生产域名纠偏",
      patch: {
        optimization_notes:
          "2026-07-14 09:02：生产发版应对准 star-project-manage.vercel.app（非误链的 star-pm 空 env 项目）。",
        next_step: "文档写死生产 URL；Vercel link 保持 star-project-manage。",
        updated_at: now,
      },
    },
  ];

  for (const item of patches) {
    const { error } = await sb.from("requirements").update(item.patch).eq("id", item.id);
    if (error) console.error("FAIL", item.id, item.note, error.message);
    else console.log("OK", item.id, item.note);
  }

  const { error: ideaErr } = await sb
    .from("studio_ideas")
    .update({
      chat_topic: "GitHub / Vercel 同步 · 生产域名",
      decision_notes:
        "2026-07-14：正式生产域名为 star-project-manage.vercel.app；发版前确认 Vercel 项目 link，避免发到无环境变量的 star-pm。",
      evolution_notes:
        "本聊天发版纠偏相关；与需求域「Git / 部署与环境配置」对齐。",
      ai_supplement:
        "状态同步能力外，部署目标一致性同样关键——错误项目 = 功能做了用户看不到。",
      updated_at: now,
    })
    .eq("id", "idea-b2202bf9");
  if (ideaErr) console.error("idea-b2202bf9", ideaErr.message);
  else console.log("OK idea-b2202bf9 部署域名备注");
}

main();
