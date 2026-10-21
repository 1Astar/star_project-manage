import { downloadTextFile, htmlToMarkdown } from "@/lib/prds/html-to-markdown";

/**
 * 导出可离线打开的 PRD：完整编辑壳（侧栏/选区工具/插入/建议/评论）+ 正文。
 * 仅替换 #document，不剥编辑能力。
 * 正文保持语义 HTML（h1–h3 / ol·ul / table / p…），便于再导出 Markdown。
 */
export function buildStandalonePrdHtml(shellHtml: string, bodyHtml: string): string {
  const mainOpen =
    '<main class="page editable" id="document" contenteditable="true">';
  const injected = shellHtml.replace(
    /<main[^>]*id="document"[^>]*>[\s\S]*?<\/main>/,
    `${mainOpen}\n${bodyHtml.trim()}\n</main>`
  );
  // 同一文档用稳定 key，避免每次导出换 key 导致左侧目录/建议丢失
  const title =
    bodyHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ||
    "prd";
  const slug = title.replace(/[^\w\u4e00-\u9fff]+/g, "-").slice(0, 40) || "prd";
  const storageKey = `minis-prd-export-stable-${slug}`;
  // 正文哈希：浏览器有稳定 key 时，换导出仍能刷到新正文（保留左侧树）
  let hash = 2166136261;
  for (let i = 0; i < bodyHtml.length; i++) {
    hash ^= bodyHtml.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const documentStamp = `h${(hash >>> 0).toString(36)}`;
  let out = injected.replace(
    /const STORAGE_KEY = '[^']+';/,
    `const STORAGE_KEY = '${storageKey}';`
  );
  // 勿回退到浏览器里其它 PRD 的旧 localStorage
  out = out.replace(
    /const PREVIOUS_STORAGE_KEY = '[^']+';/,
    `const PREVIOUS_STORAGE_KEY = '${storageKey}-none';`
  );
  out = out.replace(
    /const DOCUMENT_STAMP = '[^']*';/,
    `const DOCUMENT_STAMP = '${documentStamp}';`
  );
  return out;
}


export async function downloadStandalonePrd(opts: {
  title: string;
  bodyHtml: string;
  shellUrl?: string;
}): Promise<void> {
  const res = await fetch(opts.shellUrl ?? "/prd-shell/viewer.html");
  if (!res.ok) throw new Error("无法加载 PRD 编辑壳");
  const shell = await res.text();
  const html = buildStandalonePrdHtml(shell, opts.bodyHtml);
  const safe = (opts.title || "PRD").replace(/[\\/:*?"<>|]+/g, "_").trim();
  downloadTextFile(`${safe}.html`, html, "text/html");
}

/** 将当前正文导出为兼容 GFM 的 Markdown（.md） */
export function downloadPrdMarkdown(opts: {
  title: string;
  bodyHtml: string;
}): void {
  const md = htmlToMarkdown(opts.bodyHtml);
  const safe = (opts.title || "PRD").replace(/[\\/:*?"<>|]+/g, "_").trim();
  downloadTextFile(`${safe}.md`, md, "text/markdown");
}

/** 同时导出可编辑 HTML + Markdown */
export async function downloadPrdHtmlAndMarkdown(opts: {
  title: string;
  bodyHtml: string;
  shellUrl?: string;
}): Promise<void> {
  await downloadStandalonePrd(opts);
  downloadPrdMarkdown(opts);
}
