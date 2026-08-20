/**
 * 生成全部项目反馈 token，并写入本机对得上的 .env.local（不提交 git）。
 * 用法：npx tsx --env-file=.env.local scripts/seed-bug-feedback-tokens.ts
 */
import fs from "fs";
import path from "path";
import {
  DEFAULT_FEEDBACK_ENDPOINT,
  DEFAULT_FEEDBACK_WIDGET,
  ensureAllFeedbackTokens,
  formatFeedbackTokensEnv,
  listProjectFeedbackTokens,
} from "../lib/bugs/feedback-token";

const ROOT = path.resolve(process.cwd(), "../..");
const STAR_ENV = path.resolve(process.cwd(), ".env.local");

type LocalTarget = {
  studioProjectId: string;
  envFile: string;
  envKey: "VITE_STAR_PM_FEEDBACK_TOKEN" | "NEXT_PUBLIC_STAR_PM_FEEDBACK_TOKEN";
};

const LOCAL_TARGETS: LocalTarget[] = [
  {
    studioProjectId: "proj-moonpie",
    envFile: path.join(ROOT, "产品", "Mystic Lab  随心而行", ".env.local"),
    envKey: "VITE_STAR_PM_FEEDBACK_TOKEN",
  },
  {
    studioProjectId: "proj-02c0940a",
    envFile: path.join(ROOT, "产品", "chris-phone", ".env.local"),
    envKey: "VITE_STAR_PM_FEEDBACK_TOKEN",
  },
  {
    studioProjectId: "proj-star-pm",
    envFile: STAR_ENV,
    envKey: "NEXT_PUBLIC_STAR_PM_FEEDBACK_TOKEN",
  },
  {
    studioProjectId: "proj-1121a3da",
    envFile: path.join(ROOT, "产品", "Life Tree", "apps", "demo", ".env.local"),
    envKey: "VITE_STAR_PM_FEEDBACK_TOKEN",
  },
  {
    studioProjectId: "proj-d86aa868",
    envFile: path.join(ROOT, "产品", "c小游戏", "apps", "demo", ".env.local"),
    envKey: "VITE_STAR_PM_FEEDBACK_TOKEN",
  },
  {
    studioProjectId: "proj-personal-tools",
    envFile: path.join(ROOT, "工具", "job_radar", ".env.local"),
    envKey: "VITE_STAR_PM_FEEDBACK_TOKEN",
  },
  {
    studioProjectId: "proj-3e2817ff",
    envFile: path.join(ROOT, "工具", "竞品分析工具", "github-public", ".env.local"),
    envKey: "VITE_STAR_PM_FEEDBACK_TOKEN",
  },
];

function upsertViteEnv(filePath: string, token: string) {
  const extra = [
    `VITE_STAR_PM_FEEDBACK_TOKEN=${token}`,
    `VITE_STAR_PM_FEEDBACK_ENDPOINT=${DEFAULT_FEEDBACK_ENDPOINT}`,
    `VITE_STAR_PM_FEEDBACK_WIDGET=${DEFAULT_FEEDBACK_WIDGET}`,
  ];
  let text = "";
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    text = "";
  }
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const keys = new Set([
    "VITE_STAR_PM_FEEDBACK_TOKEN",
    "VITE_STAR_PM_FEEDBACK_ENDPOINT",
    "VITE_STAR_PM_FEEDBACK_WIDGET",
  ]);
  const kept = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return true;
    const k = trimmed.split("=")[0];
    return !keys.has(k);
  });
  while (kept.length && kept[kept.length - 1] === "") kept.pop();
  fs.writeFileSync(filePath, `${kept.join("\n")}\n\n# Star PM Bug 反馈\n${extra.join("\n")}\n`, "utf8");
}

function upsertStarPmEnv(token: string) {
  let text = "";
  try {
    text = fs.readFileSync(STAR_ENV, "utf8");
  } catch {
    text = "";
  }
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const keys = new Set(["NEXT_PUBLIC_STAR_PM_FEEDBACK_TOKEN", "STAR_PM_FEEDBACK_TOKEN"]);
  const kept = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return true;
    const k = trimmed.split("=")[0];
    return !keys.has(k);
  });
  while (kept.length && kept[kept.length - 1] === "") kept.pop();
  fs.writeFileSync(
    STAR_ENV,
    `${kept.join("\n")}\n\n# Star PM Bug 反馈\nNEXT_PUBLIC_STAR_PM_FEEDBACK_TOKEN=${token}\nSTAR_PM_FEEDBACK_TOKEN=${token}\n`,
    "utf8"
  );
}

async function main() {
  const results = await ensureAllFeedbackTokens();
  const items = await listProjectFeedbackTokens();
  const envText = formatFeedbackTokensEnv(items);
  const byId = Object.fromEntries(results.map((r) => [r.studioProjectId, r.token]));

  const written: string[] = [];
  for (const target of LOCAL_TARGETS) {
    const token = byId[target.studioProjectId];
    if (!token) continue;
    if (target.envKey === "NEXT_PUBLIC_STAR_PM_FEEDBACK_TOKEN") {
      upsertStarPmEnv(token);
    } else {
      upsertViteEnv(target.envFile, token);
    }
    written.push(target.envFile);
  }

  const dumpPath = path.resolve(process.cwd(), ".env.bug-feedback.local");
  fs.writeFileSync(dumpPath, envText, "utf8");

  console.log(`已为 ${results.length} 个项目生成/确认 token`);
  console.log("已写入本机 env：");
  for (const p of written) console.log(" -", p);
  console.log("全量导出（勿提交）：", dumpPath);
  for (const r of results) {
    console.log(` ${r.created ? "+" : "="} ${r.title}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
