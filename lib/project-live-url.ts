/** 项目对外可打开的站点：优先 demoUrl，其次 vercelUrl */
export function projectLiveSiteUrl(project: {
  demoUrl?: string | null;
  vercelUrl?: string | null;
}): string | null {
  const raw = project.demoUrl?.trim() || project.vercelUrl?.trim() || "";
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function liveSiteHostLabel(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}

/** 按域名稳定命名，同站再次打开时复用标签页而不是新开 */
export function liveSiteWindowName(url: string): string {
  try {
    const host = new URL(url).host.toLowerCase();
    return `star_pm_site_${host.replace(/[^a-z0-9]+/g, "_")}`;
  } catch {
    return "star_pm_site";
  }
}

/**
 * 打开项目站点：同域名复用已有标签页并 focus。
 * （仅对本页用本函数打开过的标签有效；用户手动另开的标签浏览器无法探测。）
 */
export function openLiveSite(url: string): Window | null {
  if (typeof window === "undefined") return null;
  const name = liveSiteWindowName(url);
  const w = window.open(url, name);
  try {
    w?.focus();
  } catch {
    /* ignore cross-origin focus limits */
  }
  return w;
}
