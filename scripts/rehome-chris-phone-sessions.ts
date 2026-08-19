/**
 * One-off: move chris-phone change sessions from demo showcase to AI Companion.
 * Run: npx tsx --env-file=.env.local scripts/rehome-chris-phone-sessions.ts
 */
import { createClient } from "@supabase/supabase-js";

const DEMO = "proj-demo-showcase";
const COMPANION = "proj-02c0940a";
const IDS = [
  "chg-b6f5b483",
  "chg-79fd7461",
  "chg-bf224042",
  "chg-07b0de6f",
  "chg-d8ebb6b3",
  "chg-1fe3388f",
  "chg-0dc03b03",
  "chg-cd65982b",
  "chg-43cda128",
  "chg-32456c55",
  "chg-b7c88246",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("缺少 Supabase 环境变量");
  const sb = createClient(url, key);

  const { data: before, error: readErr } = await sb
    .from("studio_change_sessions")
    .select("id,project_id,goal,module")
    .in("id", IDS);
  if (readErr) throw new Error(readErr.message);

  const movable = (before ?? []).filter((r) => r.project_id === DEMO);
  const skipped = (before ?? []).filter((r) => r.project_id !== DEMO);
  if (skipped.length) {
    console.log(
      "skip (not on demo):",
      skipped.map((r) => `${r.id}=${r.project_id}`).join(", ")
    );
  }

  if (!movable.length) {
    console.log("nothing to move");
    return;
  }

  const { error } = await sb
    .from("studio_change_sessions")
    .update({ project_id: COMPANION, updated_at: new Date().toISOString() })
    .in(
      "id",
      movable.map((r) => r.id)
    )
    .eq("project_id", DEMO);
  if (error) throw new Error(error.message);

  const { data: after, error: afterErr } = await sb
    .from("studio_change_sessions")
    .select("id,project_id")
    .in("id", IDS);
  if (afterErr) throw new Error(afterErr.message);

  const stillDemo = (after ?? []).filter((r) => r.project_id === DEMO);
  const onCompanion = (after ?? []).filter((r) => r.project_id === COMPANION);
  console.log(`moved ${movable.length}; now on AI Companion: ${onCompanion.length}`);
  if (stillDemo.length) {
    console.log("still on demo:", stillDemo.map((r) => r.id).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
