/** 总览附图：从附件挑图片缩略图 */

export type OverviewThumbSource = {
  url: string;
  title?: string | null;
  mime_type?: string | null;
};

export type OverviewThumbnail = {
  url: string;
  title: string;
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i;

export function isImageAttachment(a: OverviewThumbSource): boolean {
  const mime = (a.mime_type ?? "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  const url = (a.url ?? "").trim();
  if (!url) return false;
  if (IMAGE_EXT.test(url)) return true;
  // 导入落到 /import-media 的截图
  if (/\/import-media\//i.test(url)) return true;
  return false;
}

export function pickThumbnails(
  attachments: OverviewThumbSource[],
  max = 2
): OverviewThumbnail[] {
  const out: OverviewThumbnail[] = [];
  for (const a of attachments) {
    if (!isImageAttachment(a)) continue;
    const url = (a.url ?? "").trim();
    if (!url) continue;
    out.push({ url, title: (a.title ?? "").trim() || "附图" });
    if (out.length >= max) break;
  }
  return out;
}

export function firstThumbsByEntityId<T extends OverviewThumbSource & { id?: string }>(
  attachments: Array<T & { entityKey: string }>,
  maxPerEntity = 2
): Map<string, OverviewThumbnail[]> {
  const grouped = new Map<string, OverviewThumbSource[]>();
  for (const a of attachments) {
    const key = a.entityKey;
    if (!key) continue;
    const list = grouped.get(key) ?? [];
    list.push(a);
    grouped.set(key, list);
  }
  const out = new Map<string, OverviewThumbnail[]>();
  for (const [key, list] of grouped) {
    const thumbs = pickThumbnails(list, maxPerEntity);
    if (thumbs.length) out.set(key, thumbs);
  }
  return out;
}
