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

  const { data: sample } = await sb
    .from("requirements")
    .select("*")
    .eq("id", "6229bd38-ed04-4142-b4e9-ba988e70ba0b")
    .maybeSingle();
  console.log("KEYS", Object.keys(sample || {}));
  console.log(JSON.stringify(sample, null, 2));

  const { data: aiCap } = await sb
    .from("requirements")
    .select("*")
    .eq("id", "3b327836-b8ec-439f-813f-5b7526558d69")
    .maybeSingle();
  console.log("AI_CAP", JSON.stringify(aiCap, null, 2));

  const { data: projCap } = await sb
    .from("requirements")
    .select("*")
    .eq("id", "90138a45-8f84-42c6-8a96-7c75705c205b")
    .maybeSingle();
  console.log("PROJ_CAP", JSON.stringify(projCap, null, 2));
}

main();
