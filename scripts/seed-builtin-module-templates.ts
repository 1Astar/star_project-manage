/**
 * 把模块/调查模板写入 Star PM Wiki（模块「模块模板」）。
 * 用法：npx tsx --env-file=.env.local scripts/seed-builtin-module-templates.ts [--overwrite]
 */
import { getProjectById } from "@/lib/studio/data";
import { updateStudioProject } from "@/lib/studio/mutations";
import {
  BUILTIN_TEMPLATE_MODULE,
  BUILTIN_TEMPLATE_STUDIO_ID,
  ensureBuiltinModuleTemplatesInPm,
  listBuiltinTemplateSpecs,
} from "@/lib/modules/builtin-templates";

async function main() {
  const overwrite = process.argv.includes("--overwrite");
  console.log(
    `[seed] studio=${BUILTIN_TEMPLATE_STUDIO_ID} module=${BUILTIN_TEMPLATE_MODULE} overwrite=${overwrite}`
  );
  console.log(
    `[seed] specs=${listBuiltinTemplateSpecs()
      .map((s) => s.title)
      .join(" · ")}`
  );

  const result = await ensureBuiltinModuleTemplatesInPm({ overwrite });
  console.log("[seed] wiki", result);

  const studio = await getProjectById(BUILTIN_TEMPLATE_STUDIO_ID);
  if (!studio) {
    console.warn("[seed] studio project missing; skip featureModules");
    return;
  }
  const modules = [...(studio.featureModules ?? [])];
  if (!modules.includes(BUILTIN_TEMPLATE_MODULE)) {
    modules.push(BUILTIN_TEMPLATE_MODULE);
    await updateStudioProject(studio.id, { featureModules: modules });
    console.log(`[seed] featureModules += ${BUILTIN_TEMPLATE_MODULE}`);
  } else {
    console.log("[seed] featureModules already has 模块模板");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
