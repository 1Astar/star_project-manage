import {
  BUILTIN_TEMPLATE_MODULE,
  resolveBuiltinTemplatePmProjectId,
} from "@/lib/modules/builtin-templates";
import { listWikiPagesByHost } from "@/lib/wiki-pages/store";
import { getProjectById } from "@/lib/studio/data";
import { updateStudioProject } from "@/lib/studio/mutations";

async function main() {
  const projectId = await resolveBuiltinTemplatePmProjectId();
  const pages = await listWikiPagesByHost({
    projectId,
    hostKind: "module",
    hostKey: BUILTIN_TEMPLATE_MODULE,
    parentId: null,
  });
  console.log("projectId", projectId, "count", pages.length);
  for (const p of pages) {
    console.log("-", p.id, p.title, "bodyLen", (p.body || "").length);
  }

  const studio = await getProjectById("proj-star-pm");
  const mods = [...(studio?.featureModules ?? [])];
  console.log("featureModules", mods);
  if (!mods.some((m) => m.trim() === BUILTIN_TEMPLATE_MODULE)) {
    mods.push(BUILTIN_TEMPLATE_MODULE);
    await updateStudioProject("proj-star-pm", { featureModules: mods });
    console.log("added 模块模板 to featureModules");
  } else {
    console.log("already has 模块模板");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
