import {
  DEMO_SHOWCASE_PM_SLUG,
  DEMO_SHOWCASE_STUDIO_ID,
  buildDemoShowcaseSlice,
  filterStudioSnapshotForDemo,
  isDemoShowcaseId,
} from "@/lib/demo/showcase";
import { isDemoPublicScope } from "@/lib/demo/scope";
import { createPoolRequirement, ensurePmProjectForStudio } from "@/lib/db/local-store";
import { getStudioSnapshot, upsertStudioSnapshot } from "@/lib/studio/store";
import {
  getWorkbenchStudioSnapshot,
  readDemoStudioSnapshot,
} from "@/lib/studio/workbench-snapshot";
import type { StudioSnapshot } from "@/lib/studio/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { memoizeDurableRead } from "@/lib/runtime/durable-read-memo";

export { isCurrentUserViewer, isDemoPublicScope } from "@/lib/demo/scope";

async function loadDemoScopedStudio(): Promise<StudioSnapshot> {
  return memoizeDurableRead("studio-demo", async () => {
    if (isSupabaseConfigured()) {
      try {
        let snap = await readDemoStudioSnapshot();
        if (!snap.projects.some((p) => p.id === DEMO_SHOWCASE_STUDIO_ID)) {
          try {
            await ensureDemoShowcase();
            snap = await readDemoStudioSnapshot();
          } catch (e) {
            console.error("ensureDemoShowcase", e);
          }
        }
        return snap;
      } catch {
        // fall through to full+filter
      }
    }

    let snap = await getStudioSnapshot();
    if (!snap.projects.some((p) => p.id === DEMO_SHOWCASE_STUDIO_ID)) {
      try {
        await ensureDemoShowcase();
        snap = await getStudioSnapshot();
      } catch (e) {
        console.error("ensureDemoShowcase", e);
      }
    }
    return filterStudioSnapshotForDemo(snap);
  });
}

/** UI 读路径：访客/观看者只看到演示切片；缺数据时自动种子 */
export async function getScopedStudioSnapshot(): Promise<StudioSnapshot> {
  if (await isDemoPublicScope()) return loadDemoScopedStudio();
  return getStudioSnapshot();
}

/** 工作台读路径：登录态裁剪时间窗；访客仍走演示切片 */
export async function getScopedWorkbenchStudioSnapshot(): Promise<StudioSnapshot> {
  if (await isDemoPublicScope()) return loadDemoScopedStudio();
  return getWorkbenchStudioSnapshot();
}

/** 确保演示项目与样本数据存在（幂等 upsert） */
export async function ensureDemoShowcase(): Promise<{ studioId: string; pmSlug: string }> {
  const slice = buildDemoShowcaseSlice();
  await upsertStudioSnapshot({
    ...slice,
    projectColumnDefs: [],
  });

  const pm = await ensurePmProjectForStudio({
    slug: DEMO_SHOWCASE_PM_SLUG,
    name: "晨光手记（演示）",
    description: "对外演示沙盘：灵感 → 需求池 → 任务，不含真实业务",
    demo_url: "https://star-project-manage.vercel.app",
    local_run_guide: null,
    code_path: null,
    repo_full_name: null,
    repo_branch: null,
    repo_url: null,
  });

  const { readDb } = await import("@/lib/db/local-store");
  const db = await readDb();
  const existing = db.requirements.filter(
    (r) =>
      r.project_id === pm.id &&
      r.in_pool &&
      (r.studio_idea_id === "idea-demo-001" || r.title.includes("三句快写"))
  );
  if (existing.length === 0) {
    const parent = await createPoolRequirement(pm.id, {
      title: "三句快写主流程",
      type: "epic",
      priority: "P1",
      status_tags: ["完成"],
      detail_work: "打开 → 写三句 → 存本地（演示）",
      studio_idea_id: "idea-demo-001",
      inspiration_source: "演示沙盘",
      actor_name: "白昼",
      actor_note: "demo showcase seed",
      completed_at: "2026-06-15T08:00:00.000Z",
      submitted_at: "2026-06-01",
    });
    await createPoolRequirement(pm.id, {
      title: "情绪标签 6 色",
      type: "feature",
      parent_id: parent.id,
      priority: "P1",
      status_tags: ["完成"],
      detail_work: "快写时点选情绪色",
      inspiration_source: "演示沙盘",
      actor_name: "白昼",
      actor_note: "demo showcase seed",
      completed_at: "2026-07-01T04:00:00.000Z",
      submitted_at: "2026-06-15",
    });
    await createPoolRequirement(pm.id, {
      title: "晚间小结提醒（占位）",
      type: "feature",
      parent_id: parent.id,
      priority: "P2",
      status_tags: ["想法"],
      detail_work: "演示版不接真实推送",
      inspiration_source: "演示沙盘",
      actor_name: "白昼",
      actor_note: "demo showcase seed",
      submitted_at: "2026-06-15",
    });
  }

  return { studioId: DEMO_SHOWCASE_STUDIO_ID, pmSlug: pm.slug };
}

export function viewerMayAccessProject(idOrSlug: string): boolean {
  return isDemoShowcaseId(idOrSlug);
}

export async function assertViewerProjectAccess(idOrSlug: string): Promise<boolean> {
  if (!(await isDemoPublicScope())) return true;
  return viewerMayAccessProject(idOrSlug);
}
