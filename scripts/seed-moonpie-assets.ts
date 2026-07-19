/**
 * 按本地「Mystic Lab  随心而行」实况写入 proj-moonpie 资源中心 + 更新项目字段
 * 用法：npx tsx --env-file=.env.local scripts/seed-moonpie-assets.ts
 */
import { createStudioAsset, updateStudioProject } from "../lib/studio/mutations";
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
    title: "GitHub · 1Astar/Mystic-Lab",
    assetType: "repo",
    url: "https://github.com/1Astar/Mystic-Lab",
    note: "主仓 main；当前 release tag v0.2.22（本地 package.json 一致）",
    takeaway: "发版：改 package.json + CHANGELOG → commit → push --tags → merge develop",
  },
  {
    title: "Release v0.2.22",
    assetType: "repo",
    url: "https://github.com/1Astar/Mystic-Lab/releases/tag/v0.2.22",
    note: "旅程聚合、对照闭环、同题互跳、浏览器通知试用",
  },
  {
    title: "演示站 · mystic-lab-sigma",
    assetType: "experience",
    url: "https://mystic-lab-sigma.vercel.app",
    note: "Vercel 在线体验（需 HTTPS；手势建议 Chrome/Safari）",
  },
  {
    title: "本地 HTTPS 启动说明",
    assetType: "deploy",
    url: "https://github.com/1Astar/Mystic-Lab/blob/main/README.md",
    note: "npm install → npm run dev；摄像头必须 HTTPS 或 localhost",
    takeaway: "手机同网用 https://电脑IP:5173，需信任自签名证书",
  },
  {
    title: "README · 产品与手势说明",
    assetType: "doc",
    url: "https://github.com/1Astar/Mystic-Lab/blob/main/README.md",
    note: "模块表、仪式流程、手势对照、本地/构建说明",
  },
  {
    title: "CHANGELOG",
    assetType: "doc",
    url: "https://github.com/1Astar/Mystic-Lab/blob/main/CHANGELOG.md",
    note: "版本记录至 v0.2.22（2026-07-16）",
  },
  {
    title: "提问教练 AI 设计稿",
    assetType: "doc",
    url: "https://github.com/1Astar/Mystic-Lab/blob/main/docs/superpowers/specs/2026-07-14-question-coach-ai-design.md",
    note: "问法改写 / 反馈闭环设计",
  },
  {
    title: "MediaPipe Gesture Recognizer",
    assetType: "tech_doc",
    url: "https://developers.google.com/mediapipe",
    note: "本地资源 public/mediapipe/；dev/build 脚本自动拷贝",
    takeaway: "微信内置浏览器支持有限，提供触控降级",
    risk: "移动端性能与权限需实测",
  },
  {
    title: "塔罗牌面素材包",
    assetType: "material",
    url: "https://github.com/1Astar/Mystic-Lab/tree/main/public/tarot",
    note: "78 张 + 牌背；见 public/tarot/ATTRIBUTION.md",
    risk: "注意版权归属说明",
  },
  {
    title: "小六壬六神图标",
    assetType: "material",
    url: "https://github.com/1Astar/Mystic-Lab/tree/main/public/xiaoliuren/gods",
    note: "god-*.png/webp + six-gods-grid；图鉴与结果页",
  },
  {
    title: "小六壬 UI 素材（掌图/时辰/黄历）",
    assetType: "material",
    url: "https://github.com/1Astar/Mystic-Lab/tree/main/public/xiaoliuren",
    note: "palm-chart、shichen-dial、calendar-*、六神图等",
    risk: "含 UUID/ChatGPT 导出草稿图，勿当正式对外素材",
  },
  {
    title: "问法改写 / 解读反馈 Prompt 链路",
    assetType: "prompt",
    url: "https://github.com/1Astar/Mystic-Lab/tree/main/src/ai",
    note: "question-rewrite、question-feedback、reading-feedback-sync；可选同步 Star PM Ideas",
  },
  {
    title: "本机产品目录",
    assetType: "doc",
    url: "",
    note: "工具/private/产品/Mystic Lab  随心而行（与 GitHub 同步）",
    takeaway: "资源中心半自动字段：githubRepo / demoUrl / codePath 已写回项目",
  },
];

async function main() {
  invalidateStudioCache();
  const snap = await getStudioSnapshot();
  const project = snap.projects.find((p) => p.id === PROJECT_ID);
  if (!project) {
    throw new Error(`项目不存在: ${PROJECT_ID}（请确认 .env.local 指向线上库）`);
  }

  const existing = snap.assets.filter((a) => a.projectId === PROJECT_ID);
  const byTitle = new Set(existing.map((a) => a.title.trim()));

  console.log(`proj-moonpie 现有资产 ${existing.length} 条`);
  console.log(`githubRepo=${project.githubRepo ?? "—"} demo=${project.demoUrl ?? "—"}`);

  const updated = await updateStudioProject(PROJECT_ID, {
    currentStage: "v0.2.22：旅程聚合 + 小六壬对照闭环",
    nextAction: "梅花易数定位「象与变化」暂缓；旅程子页与推送级通知可后续",
    githubRepo: "1Astar/Mystic-Lab",
    githubBranch: "main",
    codePath: "工具/private/产品/Mystic Lab  随心而行",
    localRunGuide:
      "cd 「Mystic Lab  随心而行」\nnpm install\nnpm run dev\n打开 https://localhost:5173",
    demoUrl: "https://mystic-lab-sigma.vercel.app",
    vercelUrl: "https://mystic-lab-sigma.vercel.app",
    portfolioValue: "作品集核心：手势仪式 + 多体系占问 + 图鉴手札 + 旅程对照",
    body: {
      done: "塔罗/小六壬可用；图鉴手札；我的旅程；同题互跳；待对照与浏览器通知试用；v0.2.22 已发版",
      notDone: "梅花主流程；知识库深页；旅程收藏/进度深页；关页后准时推送",
      nextStep: "按需打磨对照体验；梅花「象与变化」先定文案不急做功能",
      iterations:
        "v0.1 手势抽牌 → v0.2 图鉴手札/小六壬 → v0.2.22 旅程聚合与对照闭环",
    },
  });
  console.log("UPDATED", updated.id, updated.currentStage, updated.githubRepo);

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
      url: item.url || undefined,
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
