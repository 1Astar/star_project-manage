/**
 * 导出可离线打开的 PRD：完整编辑壳（侧栏/选区工具/插入/建议/评论）+ 正文。
 * 仅替换 #document，不剥编辑能力。
 */
export function buildStandalonePrdHtml(shellHtml: string, bodyHtml: string): string {
  const mainOpen =
    '<main class="page editable" id="document" contenteditable="true">';
  const injected = shellHtml.replace(
    /<main[^>]*id="document"[^>]*>[\s\S]*?<\/main>/,
    `${mainOpen}\n${bodyHtml.trim()}\n</main>`
  );
  const storageKey = `minis-prd-export-${Date.now().toString(36)}`;
  let out = injected.replace(
    /const STORAGE_KEY = '[^']+';/,
    `const STORAGE_KEY = '${storageKey}';`
  );
  // 导出稿首次打开以文件内正文为准，勿回退到浏览器里其它 PRD 的 localStorage
  out = out.replace(
    /const PREVIOUS_STORAGE_KEY = '[^']+';/,
    `const PREVIOUS_STORAGE_KEY = '${storageKey}-none';`
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
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = (opts.title || "PRD").replace(/[\\/:*?"<>|]+/g, "_").trim();
  a.href = url;
  a.download = `${safe}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
