/**
 * 跑 organizeStarPmRequirementTree
 *   npx tsx --env-file=.env.run scripts/run-organize-req-tree.ts --dry
 *   npx tsx --env-file=.env.run scripts/run-organize-req-tree.ts
 */
import { organizeStarPmRequirementTree } from "@/lib/studio/organize-req-tree";

const dry = process.argv.includes("--dry");

async function main() {
  console.log(dry ? "[DRY]" : "[APPLY]");
  const result = await organizeStarPmRequirementTree({ dry });
  console.log({
    reparented: result.reparented,
    moduleTagged: result.moduleTagged,
    createdEpic: result.createdEpic,
    moduleSync: result.moduleSync,
    unmatchedCount: result.unmatched.length,
  });
  if (result.unmatched.length) {
    console.log("unmatched preview:");
    for (const t of result.unmatched.slice(0, 40)) console.log(" ·", t.slice(0, 70));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
