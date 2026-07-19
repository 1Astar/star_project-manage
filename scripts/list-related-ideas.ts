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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(url, key);

  const { data, error } = await sb
    .from("studio_ideas")
    .select(
      "id,title,status,type,priority,suggested_next_step,raw_input,one_line_idea,why_it_matters,chat_topic,ai_supplement,source_chat,source_method,related_module,related_project_id,occurred_at,completed_at,created_at,updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const keys =
    /MCP|capture|Stream|digest|OAuth|OpenAPI|脑暴|收件箱|Action|立刻|Bearer|stdio|分类|GitHub|Vercel|星图|整理今天|GitHub Issue/i;

  let n = 0;
  for (const i of data || []) {
    const blob = [
      i.title,
      i.one_line_idea,
      i.raw_input,
      i.chat_topic,
      i.ai_supplement,
      i.source_chat,
      i.related_module,
    ].join(" ");
    if (keys.test(blob)) {
      n++;
      console.log(
        JSON.stringify({
          id: i.id,
          title: i.title,
          status: i.status,
          type: i.type,
          priority: i.priority,
          occurred_at: i.occurred_at,
          completed_at: i.completed_at,
          created_at: i.created_at,
          updated_at: i.updated_at,
          related_project_id: i.related_project_id,
          chat_topic: i.chat_topic,
          next: (i.suggested_next_step || "").slice(0, 80),
        })
      );
    }
  }
  console.log("MATCHED", n, "of", (data || []).length);
}

main();
