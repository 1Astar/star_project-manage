/**
 * Star PM：散条需求挂父 epic + 同步功能板块到模块树 + 挂 module_l1
 *
 * 用法（仓库根）：
 *   npx tsx --env-file=.env.local scripts/organize-req-tree-and-modules.ts
 *   npx tsx --env-file=.env.local scripts/organize-req-tree-and-modules.ts --dry
 */
import { getStudioSnapshot } from "@/lib/studio/store";
import { syncFeatureModulesToModuleTree } from "@/lib/studio/feature-module-tree";
import {
  createPoolRequirement,
  listProjectModules,
  readDb,
  updateRequirement,
} from "@/lib/db/local-store";
import { AGENT_ACTOR_NAME } from "@/lib/cursor-actor";

const STUDIO_ID = "proj-star-pm";
const DRY = process.argv.includes("--dry");

const DEFAULT_MODULES = [
  "工作台",
  "项目库",
  "灵感",
  "需求任务",
  "迭代记录",
  "资源中心",
  "Git",
  "设置",
];

/** 父 epic 标题 → 匹配关键词（任一命中） */
const EPIC_RULES: Array<{ epic: string; patterns: RegExp[] }> = [
  {
    epic: "灵感捕获与整理",
    patterns: [
      /灵感/,
      /\bIdea\b/i,
      /capture/i,
      /inbox/i,
      /停车场/,
      /脑暴/,
      /digest/i,
      /星图/,
      /收件箱/,
      /记忆字段/,
      /get_idea|search.*灵感/i,
    ],
  },
  {
    epic: "今日工作台与驾驶舱",
    patterns: [
      /工作台/,
      /驾驶舱/,
      /今日焦点|今日清单|今日统计/,
      /明日待办/,
      /改进日历/,
      /待验收|需你跟进/,
      /主线/,
    ],
  },
  {
    epic: "项目与 Studio 链路",
    patterns: [
      /项目库/,
      /Studio/,
      /转成项目|转项目|convert/i,
      /父子树|parent_id.*项目|项目父子/,
      /恢复卡/,
      /新建项目/,
      /信息架构统一/,
      /退出.*返回/,
    ],
  },
  {
    epic: "Git / 部署与环境配置",
    patterns: [
      /\bGit\b/i,
      /Vercel/i,
      /部署/,
      /Cron/i,
      /[Mm]igration/,
      /种子 SQL|014 种子/,
      /stdio 落盘/,
      /仓库|Monorepo|总仓/,
      /Supabase.*接入|密钥|环境配置/,
      /Hobby/,
    ],
  },
  {
    epic: "AI 助手与长期记忆",
    patterns: [
      /\bMCP\b/,
      /AI 规则|CANONICAL|compare_sources/,
      /白昼|星辰|操作者代号/,
      /长期记忆|AI项目助手|自动拆需求/,
      /DDL|list_tables|describe_table|add_column/,
      /link_item|权限模型|操作日志/,
      /publish_release/,
      /get_ai_rules/,
    ],
  },
  {
    epic: "协作验收与资产决策",
    patterns: [
      /验收|Bug|打回/,
      /资产|资源中心|Assets/,
      /Case Study|作品集 Prompt|模板文档/,
      /评论|测试验收|分享链接/,
      /决策日志|能力地图/,
    ],
  },
  {
    epic: "创造宇宙与作品集体验",
    patterns: [/创造宇宙|作品集|星际|星空|星球桌面|案例页|Starry/i],
  },
  {
    epic: "需求任务与排期",
    patterns: [
      /需求表|需求池|需求看板|需求多视图/,
      /甘特|看板|日历/,
      /迭代计划|发版时间线|迭代记录/,
      /Side Peek|指派|状态标签|工时/,
      /parent_id \+ epic|子需求多层|requirement_links/,
      /Notion 式|列宽|拖拽挂子|筛选.*视图/,
      /进度排期|任务板/,
    ],
  },
];

/** epic 名 → 功能板块（module L1 名） */
const EPIC_TO_MODULE: Record<string, string> = {
  灵感捕获与整理: "灵感",
  今日工作台与驾驶舱: "工作台",
  "项目与 Studio 链路": "项目库",
  "Git / 部署与环境配置": "Git",
  AI助手与长期记忆: "设置",
  "AI 助手与长期记忆": "设置",
  协作验收与资产决策: "资源中心",
  创造宇宙与作品集体验: "资源中心",
  需求任务与排期: "需求任务",
};

function matchEpic(title: string): string | null {
  for (const rule of EPIC_RULES) {
    if (rule.patterns.some((p) => p.test(title))) return rule.epic;
  }
  return null;
}

async function main() {
  const snap = await getStudioSnapshot();
  const studio = snap.projects.find((p) => p.id === STUDIO_ID);
  if (!studio) throw new Error("找不到 proj-star-pm");
  const featurePaths =
    studio.featureModules?.length > 0 ? studio.featureModules : DEFAULT_MODULES;

  console.log(DRY ? "[DRY RUN]" : "[APPLY]");
  console.log("同步 featureModules → 模块树…", featurePaths.join("、"));

  const { ensurePmProjectForStudio } = await import("@/lib/db/local-store");
  const { getPmSlugForStudioProject } = await import("@/lib/project-bridge");
  const pmSlug = getPmSlugForStudioProject(studio);
  const ensured = await ensurePmProjectForStudio({
    slug: pmSlug,
    name: studio.title,
    description: studio.positioning || null,
    demo_url: studio.demoUrl,
    local_run_guide: studio.localRunGuide,
    code_path: studio.codePath,
    repo_full_name: studio.githubRepo,
    repo_branch: studio.githubBranch || null,
    repo_url: studio.githubRepo ? `https://github.com/${studio.githubRepo}` : null,
  });
  console.log("PM project", ensured.id, ensured.slug, ensured.name);

  if (!DRY) {
    const sync = await syncFeatureModulesToModuleTree(studio, featurePaths);
    console.log("module sync", sync);
  }

  const db = await readDb();
  const pm =
    db.projects.find((p) => p.id === ensured.id) ||
    db.projects.find((p) => p.slug === ensured.slug) ||
    db.projects.find((p) => p.name === "Star PM");
  if (!pm) throw new Error("找不到 PM 项目 Star PM");
  console.log(
    "using PM",
    pm.id,
    pm.slug,
    "reqs",
    db.requirements.filter((r) => r.project_id === pm.id).length
  );
  const modules = await listProjectModules(pm.id);
  const moduleByName = new Map(
    modules.filter((m) => !m.parent_id).map((m) => [m.name, m])
  );
  console.log(
    "L1 modules:",
    [...moduleByName.keys()].join("、") || "(无，请先非 dry 同步)"
  );

  let reqs = db.requirements.filter((r) => r.project_id === pm.id);
  const byTitle = new Map(reqs.map((r) => [r.title.trim(), r]));

  // 确保「需求任务与排期」epic 存在
  const NEED_EPIC = "需求任务与排期";
  if (!byTitle.has(NEED_EPIC)) {
    console.log(`创建 epic：${NEED_EPIC}`);
    if (!DRY) {
      const created = await createPoolRequirement(pm.id, {
        title: NEED_EPIC,
        type: "epic",
        status_tags: ["已规划"],
        actor_name: AGENT_ACTOR_NAME,
        actor_note: "整理散条时补总需求",
      });
      byTitle.set(NEED_EPIC, created);
      reqs = (await readDb()).requirements.filter((r) => r.project_id === pm.id);
    }
  }

  const epicIdByTitle = new Map<string, string>();
  for (const r of reqs) {
    if (!r.parent_id && (r.type === "epic" || EPIC_RULES.some((x) => x.epic === r.title))) {
      epicIdByTitle.set(r.title, r.id);
    }
  }
  // 刷新 NEED_EPIC id
  const need = reqs.find((r) => r.title === NEED_EPIC);
  if (need) epicIdByTitle.set(NEED_EPIC, need.id);

  console.log("父 epic:", [...epicIdByTitle.keys()].join(" | "));

  let reparented = 0;
  let moduleTagged = 0;
  let skipped = 0;
  const unmatched: string[] = [];

  for (const r of reqs) {
    // 已是父 epic 本身：只挂模块
    const isKnownEpic = epicIdByTitle.get(r.title) === r.id;
    if (isKnownEpic) {
      const modName = EPIC_TO_MODULE[r.title];
      const mod = modName ? moduleByName.get(modName) : null;
      if (mod && r.module_l1_id !== mod.id) {
        console.log(`  [module] epic「${r.title}」→ ${modName}`);
        if (!DRY) {
          await updateRequirement(
            r.id,
            { module_l1_id: mod.id },
            { name: AGENT_ACTOR_NAME, role: "agent" }
          );
        }
        moduleTagged += 1;
      }
      continue;
    }

    if (r.parent_id) {
      // 已有父：补模块（跟父或自匹配）
      const parent = reqs.find((p) => p.id === r.parent_id);
      const epicTitle =
        parent && epicIdByTitle.has(parent.title)
          ? parent.title
          : matchEpic(r.title) || (parent ? matchEpic(parent.title) : null);
      const modName = epicTitle ? EPIC_TO_MODULE[epicTitle] : null;
      const mod = modName ? moduleByName.get(modName) : null;
      if (mod && r.module_l1_id !== mod.id) {
        if (!DRY) {
          await updateRequirement(
            r.id,
            { module_l1_id: mod.id },
            { name: AGENT_ACTOR_NAME, role: "agent" }
          );
        }
        moduleTagged += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    // 散条根节点
    const epicTitle = matchEpic(r.title);
    if (!epicTitle) {
      unmatched.push(r.title);
      continue;
    }
    const parentId = epicIdByTitle.get(epicTitle);
    if (!parentId) {
      unmatched.push(`${r.title} (缺父 ${epicTitle})`);
      continue;
    }
    if (parentId === r.id) continue;

    const modName = EPIC_TO_MODULE[epicTitle];
    const mod = modName ? moduleByName.get(modName) : null;
    const nextType =
      r.type === "epic" ? "feature" : r.type ?? "feature";

    console.log(
      `  [reparent] ${r.title.slice(0, 48)} → ${epicTitle}` +
        (mod ? ` / ${modName}` : "")
    );
    if (!DRY) {
      await updateRequirement(
        r.id,
        {
          parent_id: parentId,
          type: nextType,
          ...(mod ? { module_l1_id: mod.id } : {}),
        },
        { name: AGENT_ACTOR_NAME, role: "agent" }
      );
    }
    reparented += 1;
    if (mod) moduleTagged += 1;
  }

  console.log("\n---");
  console.log({ reparented, moduleTagged, skipped, unmatched: unmatched.length });
  if (unmatched.length) {
    console.log("未匹配（前 40）:");
    for (const t of unmatched.slice(0, 40)) console.log(" ·", t.slice(0, 70));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
