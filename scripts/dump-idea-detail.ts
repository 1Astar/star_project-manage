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
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const ids = [
    "idea-806492e0",
    "idea-714e39da",
    "idea-bca16c15",
    "idea-80c225a8",
    "idea-c8a4a64e",
    "idea-c3359c35",
    "idea-9ed7ff5c",
    "idea-8fbdf34f",
    "idea-b2202bf9",
  ];
  const { data, error } = await sb.from("studio_ideas").select("*").in("id", ids);
  if (error) throw error;
  for (const i of data || []) {
    console.log("====", i.id, i.title);
    console.log(
      JSON.stringify(
        {
          status: i.status,
          type: i.type,
          priority: i.priority,
          occurred_at: i.occurred_at,
          completed_at: i.completed_at,
          created_at: i.created_at,
          updated_at: i.updated_at,
          one_line_idea: i.one_line_idea,
          why_it_matters: i.why_it_matters,
          raw_input: (i.raw_input || "").slice(0, 400),
          ai_supplement: (i.ai_supplement || "").slice(0, 400),
          chat_topic: i.chat_topic,
          source_chat: i.source_chat,
          source_method: i.source_method,
          related_module: i.related_module,
          suggested_next_step: i.suggested_next_step,
          decision_notes: (i.decision_notes || "").slice(0, 200),
          evolution_notes: (i.evolution_notes || "").slice(0, 200),
        },
        null,
        2
      )
    );
  }
}

main();
