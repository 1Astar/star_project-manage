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

  const ids = [
    "idea-806492e0",
    "idea-c3359c35",
    "idea-714e39da",
    "idea-bca16c15",
    "idea-80c225a8",
    "idea-8fbdf34f",
    "idea-c8a4a64e",
    "idea-9ed7ff5c",
    "idea-b2202bf9",
  ];

  const { data: ideas, error } = await sb
    .from("studio_ideas")
    .select(
      "id,title,status,priority,occurred_at,completed_at,chat_topic,suggested_next_step,ai_supplement,decision_notes"
    )
    .in("id", ids);
  if (error) throw error;

  console.log("=== IDEAS ===");
  for (const i of ideas || []) {
    console.log(
      [
        i.id,
        i.status,
        i.priority,
        "occurred=" + (i.occurred_at || "-"),
        "done=" + (i.completed_at || "-"),
        i.title,
      ].join(" | ")
    );
  }

  const { data: reqs } = await sb
    .from("requirements")
    .select("id,title,status,detail_work,acceptance_criteria,priority,updated_at")
    .or(
      "title.ilike.%灵感%,title.ilike.%Studio%,title.ilike.%capture%,title.ilike.%MCP%,detail_work.ilike.%灵感%,detail_work.ilike.%Git%,detail_work.ilike.%Studio%"
    )
    .limit(40);

  console.log("=== REQS ===");
  console.log(JSON.stringify(reqs, null, 2));

  // Also studio tasks related
  const { data: tasks } = await sb
    .from("studio_tasks")
    .select("id,title,status,project_id,updated_at")
    .or("title.ilike.%MCP%,title.ilike.%capture%,title.ilike.%OAuth%,title.ilike.%Stream%,title.ilike.%digest%")
    .limit(30);
  console.log("=== STUDIO TASKS ===");
  console.log(JSON.stringify(tasks, null, 2));
}

main();
