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
