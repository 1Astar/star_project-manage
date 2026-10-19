#!/usr/bin/env node
/**
 * CI / 本地 build 分流：
 * - Cloudflare Workers Builds / Pages → OpenNext（wrangler deploy 需要 .open-next）
 * - Vercel / 本地默认 → next build
 *
 * 检测：VERCEL=1 → Next；CF_PAGES / WORKERS_CI / HOME=/opt/buildhome → OpenNext
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

const cmd = isCloudflare ? "opennextjs-cloudflare" : "next";
const args = isCloudflare ? ["build"] : ["build"];

console.log(
  `[ci-build] platform=${isVercel ? "vercel" : isCloudflare ? "cloudflare" : "local"} → ${cmd} ${args.join(" ")}`
);

const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
