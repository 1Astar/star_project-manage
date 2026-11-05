/**
 * 同一 PRD 内多页面：打包进 html_content 前缀注释，避免未跑 migration 时丢页。
 * 单页时不写前缀，保持纯 HTML。
 */

export type PrdDocPage = {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
  expanded?: boolean;
  content: string;
  prototypeUrl?: string;
};

const MARKER = "<!--STAR_PRD_PAGES:";

type Bundle = {
  v: 1;
  activeId: string;
  pages: Array<{
    id: string;
    title: string;
    parentId: string | null;
    order: number;
    content: string;
  }>;
};

export function unpackPrdDocument(html: string): {
  html: string;
  pages: PrdDocPage[] | null;
  activeId: string | null;
} {
  const raw = String(html ?? "");
  if (!raw.startsWith(MARKER)) {
    return { html: raw, pages: null, activeId: null };
  }
  const end = raw.indexOf("-->");
  if (end < 0) return { html: raw, pages: null, activeId: null };
  const json = raw.slice(MARKER.length, end).trim();
  const body = raw.slice(end + 3).replace(/^\n/, "");
  try {
    const data = JSON.parse(json) as Bundle;
    if (!data || !Array.isArray(data.pages) || data.pages.length === 0) {
      return { html: body || raw, pages: null, activeId: null };
    }
    return {
      html: body,
      activeId: data.activeId || data.pages[0]?.id || null,
      pages: data.pages.map((p, i) => ({
        id: String(p.id),
        title: String(p.title || "未命名页面"),
        parentId: p.parentId == null || p.parentId === "" ? null : String(p.parentId),
        order: Number.isFinite(Number(p.order)) ? Number(p.order) : i,
        expanded: true,
        content: String(p.content ?? ""),
      })),
    };
  } catch {
    return { html: body || raw, pages: null, activeId: null };
  }
}

/** 仅打包内容页（不含原型页）。≤1 页则返回裸 HTML。 */
export function packPrdDocument(
  pages: PrdDocPage[],
  activeId: string,
  fallbackHtml: string
): string {
  const contentPages = pages.filter((p) => !p.prototypeUrl);
  if (contentPages.length <= 1) {
    const only = contentPages[0];
    return only?.content ?? fallbackHtml;
  }
  const root =
    contentPages.find((p) => !p.parentId) ||
    contentPages.find((p) => p.id === activeId) ||
    contentPages[0];
  const bundle: Bundle = {
    v: 1,
    activeId: activeId || root.id,
    pages: contentPages.map((p, i) => ({
      id: p.id,
      title: p.title,
      parentId: p.parentId,
      order: Number.isFinite(p.order) ? p.order : i,
      content: p.content,
    })),
  };
  const primary = contentPages.find((p) => p.id === activeId)?.content
    ?? root.content
    ?? fallbackHtml;
  return `${MARKER}${JSON.stringify(bundle)}-->\n${primary}`;
}

export function displayHtmlFromStored(html: string): string {
  return unpackPrdDocument(html).html;
}
