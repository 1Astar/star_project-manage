/** Vercel / Cloudflare / EdgeOne Makers / similar serverless deploys. */
export function isProductionLikeRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.CF_PAGES === "1" ||
    process.env.CLOUDFLARE === "1" ||
    process.env.WORKERS_CI === "1" ||
    process.env.NEXT_PUBLIC_CF_WORKER === "1" ||
    process.env.EDGEONE === "1" ||
    process.env.EDGEONE_PAGES === "1" ||
    process.env.NEXT_PUBLIC_EDGEONE === "1" ||
    Boolean(process.env.OPEN_NEXT_ORIGIN) ||
    Boolean(process.env.OPEN_NEXT_BUILD_ID)
  );
}

/** `next build` 收集/预渲染阶段；此时 CF/Vercel 密钥常尚未注入，勿当运行时失败。 */
export function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}
