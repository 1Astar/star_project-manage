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
