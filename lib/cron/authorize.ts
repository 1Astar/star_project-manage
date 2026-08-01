/**
 * Cron route auth: Authorization Bearer (Vercel / CF / manual curl).
 * Optional header `x-cron-secret` for platforms that cannot set Authorization.
 * EdgeOne `schedules` 默认不带自定义头 → 若平台定时 401，请用外部定时带 Bearer，
 * 或设置 CRON_ALLOW_EDGEONE_SCHEDULE=1（仅建议在确认调度来源可信后开启）。
 */
export function authorizeCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET ?? "dev-cron-secret";
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret && headerSecret === cronSecret) return true;

  if (
    process.env.CRON_ALLOW_EDGEONE_SCHEDULE === "1" &&
    (process.env.EDGEONE === "1" ||
      process.env.EDGEONE_PAGES === "1" ||
      process.env.NEXT_PUBLIC_EDGEONE === "1")
  ) {
    return true;
  }

  return false;
}
