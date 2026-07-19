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

type Patch = Record<string, unknown>;

async function main() {
  loadEnv();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const patches: Array<{ id: string; note: string; patch: Patch }> = [
    {
      id: "idea-806492e0",
      note: "GPT Capture DB-first",
      patch: {
        // 脑暴提出：2026-07-13 15:44 CST → UTC 07:44（与同日 Action 测试 capture 时刻对齐）
        occurred_at: "2026-07-13T07:44:00.000Z",
        // 完成：DB-first 上线并标记 done 的批次时间（已有，保留核对）
        completed_at: "2026-07-14T02:05:20.708Z",
        status: "done",
        priority: "P0",
        chat_topic: "GPT Capture → POST 后立刻进收件箱",
        source_chat: "Cursor · Star PM Capture/MCP 会话（2026-07-13～14）",
        source_method: "ChatGPT",
        related_module: "api/ideas/capture · captureIdea",
        related_project_id: "proj-star-pm",
        why_it_matters:
          "外部脑暴工具核心价值是「说完即存」；只建 GitHub Issue 再手动同步会让 Action 看起来失败。",
        ai_supplement:
          "路径改为 POST /api/ideas/capture → captureIdea() → createStudioIdea，成功返回 ideaId。站内 /api/studio/ideas/capture 同步 DB-first。OpenAPI 规范 scripts/chatgpt-ideas-capture.openapi.yaml 同步为 ideaId 响应。GitHub Issue 同步保留但不再是主链路。",
        decision_notes:
          "2026-07-13 决策：DB-first，放弃「Capture 只写 GitHub」主路径。",
        evolution_notes:
          "2026-07-13 15:43 澄清是 Action OpenAPI 架构问题；15:44 明确立刻进收件箱；同日代码落地；2026-07-14 生产部署核对。",
        suggested_next_step:
          "用生产 IDEAS_CAPTURE_SECRET 回归 Custom GPT Action；确认响应字段为 ideaId。",
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: "idea-c3359c35",
      note: "同日早期 capture 测试条 → 收敛为已完成技术验证",
      patch: {
        // occurred_at / completed_at 已有，不改写
        status: "done",
        priority: "P1",
        related_project_id: "proj-star-pm",
        title: "ChatGPT Capture API 联调验证",
        one_line_idea: "用 API 从对话捕获灵感并验证入库链路（早期联调记录）。",
        chat_topic: "GPT Action / Capture 联调",
        source_chat: "Cursor · Star PM Capture/MCP 会话（2026-07-13）",
        source_method: "ChatGPT",
        related_module: "api/ideas/capture",
        why_it_matters:
          "证明外链 ChatGPT 能打到 Star PM；后续 DB-first 改造以此链路为基线。",
        ai_supplement:
          "occurred_at=2026-07-13T07:44:39Z 与「立刻进收件箱」需求同一时段。早期记录偏英文草稿；主需求收敛到 idea-806492e0（DB-first 已 done）。",
        decision_notes: "保留为联调证据条；产品主叙事看 idea-806492e0。",
        suggested_next_step: "无需再做；作为 Capture 联调履历归档。",
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: "idea-714e39da",
      note: "AI灵感捕获系统 — 补时间与本聊天决策",
      patch: {
        occurred_at: "2026-07-13T07:48:00.000Z", // 15:48 CST 讨论「自动分类→关联项目 / 是否必须在特定 GPT」
        chat_topic: "Action 创建 idea → 自动分类 → 关联项目；MCP 捕获",
        source_chat: "Cursor · Star PM Capture/MCP 会话（2026-07-13～14）",
        source_method: "ChatGPT",
        related_module: "capture_idea · MCP · Custom GPT Action",
        related_project_id: "proj-star-pm",
        why_it_matters:
          "多入口（GPT Action / Cursor MCP / 站内）共用单一收件箱，才能支撑「灵感演进」叙事。",
        ai_supplement:
          "边界：Custom GPT Action 仅在该 GPT 可用；分类/关联项目短期靠 Instructions 填 type、relatedProjectId，服务端暂不做自动分类。通道扩展：2026-07-13 提出 MCP；2026-07-14 决策 Cursor 走 /api/mcp Bearer，ChatGPT 走 /api/mcp-oauth/mcp OAuth。capture_idea / create_task / convert_idea 等工具已在 MCP 落地。待办仍是「识别规则」更聪明与服务端 analyze。",
        decision_notes:
          "双路径鉴权（Bearer vs OAuth）；生产域名锁定 star-project-manage.vercel.app。",
        evolution_notes:
          "2026-07-13 15:48 边界澄清；15:54 要做 MCP；16:06～10 本地+远程+Redis；2026-07-14 09:02 域名纠偏；09:22～38 GPT OAuth 落地。",
        suggested_next_step:
          "先维护项目 ID 映射表给 GPT Instructions；再评估服务端 analyze_idea 自动分类。",
        status: "inbox",
        priority: "P0",
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: "idea-bca16c15",
      note: "Idea Stream — 补聊天主题与分析（时间已有不改）",
      patch: {
        chat_topic: "脑暴洪水 / Idea Stream",
        source_chat: "Cursor · Star PM Capture/MCP 会话（Idea Stream 愿景）",
        source_method: "ChatGPT",
        related_module: "/stream",
        ai_supplement:
          "分阶段：P0 时间线 → P1 日 digest → P2 路由 → P3 星图。「创造宇宙」首页可视化。已实现 /stream 时间线/表格双视图与快记。",
        decision_notes: "以 Stream 承载当天创造过程，表格收件箱偏事后管理。",
        evolution_notes:
          "愿景在 2026-07-13 会话提出；条目 occurred/completed 已标注；完成批次 2026-07-14T02:05:21Z。",
        suggested_next_step: "用真实一周脑暴验证 digest「确认后再执行」。",
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: "idea-80c225a8",
      note: "整理今日脑暴 — 补分析（时间已有不改）",
      patch: {
        chat_topic: "整理今天的脑暴",
        source_chat: "Cursor · Star PM Capture/MCP 会话（Idea Stream P1）",
        source_method: "ChatGPT",
        related_module: "api/studio/ideas/digest",
        ai_supplement:
          "输出 themes / clusters / suggestedRoutes（转项目·任务·观察·丢弃）/ stats；必须用户确认后再执行写库。",
        decision_notes: "AI 建议与执行分离，避免误伤灵感。",
        evolution_notes: "与 Idea Stream 同会话落地；completed_at 已有 2026-07-14T02:05:21Z。",
        suggested_next_step: "digest 建议路由后考虑「转需求」接入 idea-8fbdf34f。",
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: "idea-8fbdf34f",
      note: "AI 自动拆需求 — 核对时间保留，补主题",
      patch: {
        // occurred_at 已有 2026-07-14T01:54:47Z，不改
        chat_topic: "脑暴洪水 → 可执行需求",
        source_chat: "Cursor · Star PM 会话",
        source_method: "ChatGPT",
        related_module: "digest → 需求/子任务",
        ai_supplement:
          "与「整理今日脑暴」衔接：聚类后增加「转需求」动作，落到 PRD/看板层。",
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: "idea-c8a4a64e",
      note: "星图导航 — 对应 Stream P3，补发生日（会话愿景日）",
      patch: {
        // 无精确到分钟；用愿景讨论日 2026-07-13（CST）正午作发生锚点，避免空 occurred
        occurred_at: "2026-07-13T04:00:00.000Z", // 2026-07-13 12:00 CST
        chat_topic: "Idea Stream P3 · 创造宇宙星图",
        source_chat: "Cursor · Star PM Capture/MCP 会话（星图愿景）",
        source_method: "ChatGPT",
        related_module: "idea-star-map · /stream",
        ai_supplement:
          "Idea Stream 路线图 P3：首页「创造宇宙」可视化；与作品集星球桌面（idea-9ed7ff5c）叙事一致。内部导航 vs 对外作品集可分阶段。",
        suggested_next_step: "先做内部 /stream 星图信息架构，再对外作品集星球桌面。",
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: "idea-9ed7ff5c",
      note: "作品集星球桌面 — 时间已有，补与星图关联",
      patch: {
        chat_topic: "创造宇宙 · 作品集对外叙事",
        source_chat: "Cursor · Star PM 会话",
        ai_supplement:
          "与 idea-c8a4a64e（项目宇宙星图）同源叙事：对内工作台星图，对外作品集星球桌面。",
        evolution_notes: "occurred_at 已有 2026-07-14T01:54:47Z，保留。",
        updated_at: new Date().toISOString(),
      },
    },
  ];

  for (const item of patches) {
    const { error } = await sb.from("studio_ideas").update(item.patch).eq("id", item.id);
    if (error) {
      console.error("FAIL", item.id, item.note, error.message);
    } else {
      console.log("OK", item.id, item.note);
    }
  }

  // 核对
  const ids = patches.map((p) => p.id);
  const { data } = await sb
    .from("studio_ideas")
    .select("id,title,status,occurred_at,completed_at,chat_topic,priority")
    .in("id", ids);
  console.log(JSON.stringify(data, null, 2));
}

main();
