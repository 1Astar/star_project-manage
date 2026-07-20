/**
 * 将 CHANGELOG.md 各版本条目导入 Star PM 演进（releaseTag + 关键词板块）
 * Usage: npx tsx --env-file=.env.local scripts/import-changelog-evolution.ts [projectId]
 */
import { importChangelogAsEvolution } from "../lib/studio/mutations";

async function main() {
  const projectId = process.argv[2] || "proj-star-pm";
  const result = await importChangelogAsEvolution({
    projectId,
    fromRepoFile: true,
  });
  console.log(
    JSON.stringify(
      {
        projectId,
        imported: result.imported,
        skipped: result.skipped,
        inferredModules: result.inferredModules,
        pendingModules: result.pendingModules,
        sample: result.items.slice(0, 8),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
