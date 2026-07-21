import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { humanizeDbError } from "../lib/studio/route-utils";

async function main() {
  const raw =
    "Could not find the 'feature_modules' column of 'studio_projects' in the schema cache";
  const msg = humanizeDbError(raw);
  assert.match(msg, /028_evolution_modules/);
  assert.match(msg, /feature_modules/);
  console.log("humanizeDbError ok:", msg);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("skip live verify (no env)");
    return;
  }
  const sb = createClient(url, key);
  const { data, error } = await sb
    .from("studio_projects")
    .select("id,title,github_repo,feature_modules");
  if (error) throw error;
  const unbound = (data ?? []).filter((p) => !String(p.github_repo || "").trim());
  console.log(
    "live verify OK: projects=",
    data?.length,
    "unbound=",
    unbound.length,
    unbound.map((p) => p.title)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
