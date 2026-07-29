/**
 * 把「已上线但未标完成」的需求标成完成（保守）。
 * 用法：npx tsx --env-file=.env.local scripts/mark-shipped-requirements.ts [--dry]
 *
 * 只做：
 * 1) 已是 done / 已完成 等 → 归一成标签「完成」
 * 2) 同项目下有同名（或高度相似）且 status=done 的 Studio 任务 → 标完成
 * 3) 父需求：全部子需求完成后才标
 * 不按「标题含六爻/塔罗」瞎标。
 */
import { getProjects, updateRequirement, readDb } from "@/lib/db/local-store";
import { requirementIsDone } from "@/lib/types";
import { applyLifecycleStatus } from "@/lib/requirement-status";
import { AGENT_ACTOR_NAME } from "@/lib/cursor-actor";
import { getStudioSnapshot } from "@/lib/studio/store";

const DRY = process.argv.includes("--dry");

function norm(s: string) {
  return s.toLowerCase().replace(/[\s\[\]【】P0-3p·\-_/]/g, "");
}

function similar(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return x.length >= 6 && y.length >= 6;
  return false;
}

async function main() {
  const projects = await getProjects();
  console.log("projects", projects.map((p) => `${p.slug}:${p.name}`).join(" | "));

  const studio = await getStudioSnapshot();
  const doneTasks = studio.tasks.filter((t) => t.status === "done");
  console.log("studio done tasks", doneTasks.length);

  const db = await readDb();
  const targetIds = new Set(
    projects
      .filter((p) => /随心而行|Star PM|moonpie|star-pm|晨光/i.test(`${p.slug} ${p.name}`))
      .map((p) => p.id)
  );
  if (targetIds.size === 0) {
    console.log("no target projects in DB (need admin/supabase env)");
    return;
  }

  const byParent = new Map<string, string[]>();
  for (const r of db.requirements) {
    if (!r.parent_id) continue;
    const list = byParent.get(r.parent_id) ?? [];
    list.push(r.id);
    byParent.set(r.parent_id, list);
  }

  let marked = 0;
  let skipped = 0;

  const reqs = db.requirements.filter((r) => targetIds.has(r.project_id));
  const leaves = reqs.filter((r) => !(byParent.get(r.id)?.length));

  for (const r of leaves) {
    if (requirementIsDone(r)) {
      if (!(r.status_tags ?? []).includes("完成")) {
        console.log("normalize", r.title);
        if (!DRY) {
          await updateRequirement(
            r.id,
            { status_tags: applyLifecycleStatus(r.status_tags, "完成") },
            { name: AGENT_ACTOR_NAME, role: "ai" }
          );
        }
        marked++;
      } else skipped++;
      continue;
    }

    const hit = doneTasks.find((t) => similar(t.title, r.title));
    const alreadyMachineDone = r.status === "done";
    if (!hit && !alreadyMachineDone) {
      skipped++;
      continue;
    }

    console.log("mark leaf", hit ? `← studio:${hit.title}` : "← status=done", "|", r.title);
    if (!DRY) {
      await updateRequirement(
        r.id,
        {
          status_tags: applyLifecycleStatus(r.status_tags, "完成"),
          completed_at: r.completed_at ?? new Date().toISOString(),
        },
        { name: AGENT_ACTOR_NAME, role: "ai" }
      );
    }
    marked++;
  }

  for (const r of reqs.filter((x) => (byParent.get(x.id)?.length ?? 0) > 0)) {
    if (requirementIsDone(r)) {
      skipped++;
      continue;
    }
    const fresh = await readDb();
    const kids = (byParent.get(r.id) ?? [])
      .map((id) => fresh.requirements.find((x) => x.id === id))
      .filter(Boolean);
    if (kids.length && kids.every((k) => k && requirementIsDone(k))) {
      console.log("mark parent", r.title);
      if (!DRY) {
        await updateRequirement(
          r.id,
          { status_tags: applyLifecycleStatus(r.status_tags, "完成") },
          { name: AGENT_ACTOR_NAME, role: "ai" }
        );
      }
      marked++;
    }
  }

  console.log({ dry: DRY, marked, skipped, total: reqs.length, leaves: leaves.length });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
