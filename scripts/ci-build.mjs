#!/usr/bin/env node
/**
 * CI / 本地 build 分流：
 * - Cloudflare Workers Builds / Pages → OpenNext（wrangler deploy 需要 .open-next）
 * - Vercel / 本地默认 → next build
 *
 * 防套娃（硬规则）：
 * OpenNext 内部会执行 `npm run build`（见 @opennextjs/aws buildNextApp）。
 * 若此时再调 opennextjs-cloudflare → 无限递归直到 CF 超时。
 * OpenNext 在调 npm run build 前会设 NEXT_PRIVATE_STANDALONE=true；
 * 已在 OpenNext 内时只跑 next build。
 *
 * 检测：VERCEL=1 → Next；CF_PAGES / WORKERS_CI / HOME=/opt/buildhome → OpenNext（顶层）
 */
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

const env = process.env;
const isVercel = env.VERCEL === "1" || env.VERCEL === "true";
const home = env.HOME || homedir() || "";
const isCloudflare =
  !isVercel &&
  (env.CF_PAGES === "1" ||
    env.CF_PAGES === "true" ||
    env.WORKERS_CI === "1" ||
    env.WORKERS_CI === "true" ||
    env.CLOUDFLARE === "1" ||
    home === "/opt/buildhome" ||
    home.startsWith("/opt/buildhome/"));

/** OpenNext 已在跑 Next 阶段，或显式强制只跑 next */
const insideOpenNext =
  env.NEXT_PRIVATE_STANDALONE === "true" ||
  env.OPENNEXT_RECURSION_GUARD === "1" ||
  env.CI_BUILD_FORCE_NEXT === "1";

const useOpenNext = isCloudflare && !insideOpenNext;
const cmd = useOpenNext ? "opennextjs-cloudflare" : "next";
/** Next 15.5.x 已超出 OpenNext「官方支持窗口」检查；CF 仍需能构建，显式放行 */
const args = useOpenNext
  ? ["build", "--dangerouslyUseUnsupportedNextVersion"]
  : ["build"];

const platformLabel = isVercel
  ? "vercel"
  : useOpenNext
    ? "cloudflare"
    : isCloudflare
      ? "cloudflare-nested-next"
      : "local";

console.log(`[ci-build] platform=${platformLabel} → ${cmd} ${args.join(" ")}`);

const childEnv = useOpenNext
  ? { ...env, OPENNEXT_RECURSION_GUARD: "1" }
  : env;

const r = spawnSync(cmd, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: childEnv,
});
process.exit(r.status ?? 1);
