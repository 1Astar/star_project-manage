/** 推送/外链用的站点根 URL */

export function resolveSiteBaseUrl(siteBaseUrl?: string | null): string {
  const raw =
    siteBaseUrl?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`
      : "") ||
    "https://pm.starry-studio.cn";
  return raw.replace(/\/$/, "");
}

export function absoluteAppUrl(
  siteBaseUrl: string | null | undefined,
  pathOrUrl: string,
): string {
  const p = pathOrUrl.trim();
  if (!p) return resolveSiteBaseUrl(siteBaseUrl);
  if (/^https?:\/\//i.test(p)) return p;
  const base = resolveSiteBaseUrl(siteBaseUrl);
  return `${base}${p.startsWith("/") ? p : `/${p}`}`;
}
