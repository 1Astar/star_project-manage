/**
 * 补写「我的旅程 / 梅花」等资源条目到 proj-moonpie
 * npx tsx --env-file=.env.local scripts/seed-moonpie-assets-extra.ts
 */
import { createStudioAsset } from "../lib/studio/mutations";
import { getStudioSnapshot, invalidateStudioCache } from "../lib/studio/store";
import type { AssetType } from "../lib/studio/types";

const PROJECT_ID = "proj-moonpie";

const ASSETS: Array<{
  title: string;
  assetType: AssetType;
  url?: string;
  note?: string;
  takeaway?: string;
  risk?: string | null;
}> = [
  {
    title: "我的旅程 · 路由 /records",
    assetType: "experience",
    url: "https://mystic-lab-sigma.vercel.app/records",
    note: "聚合塔罗手札 + 小六壬手札；分区导航、同题对照摘要、结果页互跳入口",
    takeaway: "源码：src/pages/journey.ts · src/journal/journey.ts · cross-ask.ts",
  },
  {
    title: "旅程同题互跳逻辑",
    assetType: "doc",
    url: "https://github.com/1Astar/Mystic-Lab/blob/main/src/journal/cross-ask.ts",
    note: "「也用另一体系看一眼」预填问题互跳塔罗 ↔ 小六壬",
  },
  {
    title: "塔罗愚者旅程图鉴",
    assetType: "doc",
    url: "https://github.com/1Astar/Mystic-Lab/blob/main/src/knowledge/fool-journey.ts",
    note: "大阿卡那 0–21 成长旅程文案；图鉴路径 /tarot/tujian",
    takeaway: "与「我的旅程」记录互补：一个是牌义旅程，一个是占问履历",
  },
  {
    title: "小六壬掌上演算之旅",
    assetType: "doc",
    url: "https://github.com/1Astar/Mystic-Lab/blob/main/src/xiaoliuren/palm-journey.ts",
    note: "掌诀 Lv1–Lv6 教学旅程；与手札对照闭环配合",
  },
  {
    title: "梅花易数 · 占位页 /meihua",
    assetType: "experience",
    url: "https://mystic-lab-sigma.vercel.app/meihua",
    note: "定位「象与变化」；动念起卦 / 卦象图鉴 / 梅花手札均 comingSoon",
    takeaway: "源码：src/pages/meihua-home.ts；Slogan：一念成卦，观变化，也观人心",
    risk: "主流程未做，勿对外承诺可用",
  },
  {
    title: "三体系首页定位文案",
    assetType: "doc",
    url: "https://github.com/1Astar/Mystic-Lab/blob/main/src/pages/lab-home.ts",
    note: "塔罗=心理探索 · 小六壬=时间趋势 · 梅花=象与变化（未开放）",
  },
  {
    title: "知识库入口（即将开放）",
    assetType: "doc",
    url: "https://mystic-lab-sigma.vercel.app/knowledge",
    note: "Lab 首页 GLOBAL_ENTRIES；学习不同占问体系",
    risk: "页面可能仍为占位",
  },
];

async function main() {
  invalidateStudioCache();
  const snap = await getStudioSnapshot();
  if (!snap.projects.some((p) => p.id === PROJECT_ID)) {
    throw new Error(`项目不存在: ${PROJECT_ID}`);
  }
  const byTitle = new Set(
    snap.assets.filter((a) => a.projectId === PROJECT_ID).map((a) => a.title.trim())
  );

  let created = 0;
  let skipped = 0;
  for (const item of ASSETS) {
    if (byTitle.has(item.title.trim())) {
      console.log("SKIP", item.title);
      skipped += 1;
      continue;
    }
    const asset = await createStudioAsset({
      title: item.title,
      projectId: PROJECT_ID,
      assetType: item.assetType,
      url: item.url,
      note: item.note,
      takeaway: item.takeaway,
      risk: item.risk ?? null,
    });
    console.log("CREATED", asset.id, asset.assetType, asset.title);
    created += 1;
  }
  console.log(JSON.stringify({ created, skipped, totalDesired: ASSETS.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
