/**
 * PRD 一键导入：md / html / 纯文本 → 大纲预览 + PRD 壳可用 HTML。
 * 纯文本按大/小标题启发式套格式（#、1. / 1.1 / 一、等）。
 */

export type PrdImportFormat = "markdown" | "html" | "plain";

export type PrdImportOutlineItem = {
  level: 1 | 2 | 3;
  text: string;
};

export type PrdImportPreview = {
  format: PrdImportFormat;
  title: string;
  outline: PrdImportOutlineItem[];
  html: string;
  warnings: string[];
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectPrdImportFormat(raw: string): PrdImportFormat {
  const t = raw.trim();
  if (!t) return "plain";
  if (/^<!DOCTYPE|^<html[\s>]|^<body[\s>]|<h[1-6][\s>]|<p[\s>]/i.test(t)) {
    return "html";
  }
  // 多行且有 markdown 标题/列表/强调 → md
  const mdHits =
    (t.match(/^#{1,6}\s+\S+/gm) ?? []).length +
    (t.match(/^\s*[-*+]\s+\S+/gm) ?? []).length +
    (t.match(/\*\*[^*]+\*\*/g) ?? []).length;
  if (mdHits >= 1 && !/^</.test(t)) return "markdown";
  return "plain";
}

/** 从 HTML 抽大纲 */
function outlineFromHtml(html: string): PrdImportOutlineItem[] {
  const items: PrdImportOutlineItem[] = [];
  const re = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const level = Number(m[1]) as 1 | 2 | 3;
    const text = stripTags(m[2] ?? "").trim();
    if (text) items.push({ level, text });
  }
  return items;
}

function titleFromOutline(outline: PrdImportOutlineItem[], fallback: string): string {
  const h1 = outline.find((o) => o.level === 1);
  if (h1) return h1.text.slice(0, 80);
  const h2 = outline.find((o) => o.level === 2);
  if (h2) return h2.text.slice(0, 80);
  return fallback.slice(0, 80) || "导入的 PRD";
}

/** 极简 Markdown → HTML（标题/段落/列表/粗斜体/代码/链接） */
export function markdownToPrdHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    const raw = para.join(" ").trim();
    para = [];
    if (!raw) return;
    out.push(`<p>${inlineMd(raw)}</p>`);
  };

  const inlineMd = (s: string) =>
    escapeHtml(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(
        /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
      );

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushPara();
      const level = Math.min(3, heading[1].length);
      out.push(`<h${level}>${inlineMd(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }
    if (/^\s*```/.test(line)) {
      flushPara();
      i += 1;
      const code: string[] = [];
      while (i < lines.length && !/^\s*```/.test(lines[i] ?? "")) {
        code.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) i += 1;
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const ul = line.match(/^\s*[-*+]\s+(.+)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ul || ol) {
      flushPara();
      const ordered = Boolean(ol);
      const items: string[] = [];
      while (i < lines.length) {
        const L = lines[i] ?? "";
        const um = L.match(/^\s*[-*+]\s+(.+)$/);
        const om = L.match(/^\s*\d+[.)]\s+(.+)$/);
        if (ordered ? om : um) {
          items.push(`<li>${inlineMd((ordered ? om![1] : um![1]).trim())}</li>`);
          i += 1;
          continue;
        }
        break;
      }
      out.push(
        ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`
      );
      continue;
    }
    if (!line.trim()) {
      flushPara();
      i += 1;
      continue;
    }
    para.push(line.trim());
    i += 1;
  }
  flushPara();
  return out.join("\n") || "<p></p>";
}

/**
 * 纯文本大纲启发式：
 * - 首行非空 → h1（若不像小节编号）
 * - `#` 已在 markdown 路径
 * - `1.` / `一、` / `第一章` → h2
 * - `1.1` / `（1）` / `1.1.1` → h3
 * - 其余合并为段落
 */
export function plainTextToPrdHtml(text: string): {
  html: string;
  outline: PrdImportOutlineItem[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const outline: PrdImportOutlineItem[] = [];
  const out: string[] = [];
  let usedH1 = false;
  let para: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    const t = para.join(" ").trim();
    para = [];
    if (t) out.push(`<p>${escapeHtml(t)}</p>`);
  };

  const pushHeading = (level: 1 | 2 | 3, title: string) => {
    flushPara();
    const t = title.trim();
    if (!t) return;
    outline.push({ level, text: t });
    out.push(`<h${level}>${escapeHtml(t)}</h${level}>`);
    if (level === 1) usedH1 = true;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx] ?? "";
    const line = raw.trim();
    if (!line) {
      flushPara();
      continue;
    }

    // Markdown 标题混入纯文本
    const mdH = line.match(/^(#{1,6})\s+(.+)$/);
    if (mdH) {
      const level = Math.min(3, mdH[1].length) as 1 | 2 | 3;
      pushHeading(level, mdH[2]);
      continue;
    }

    // 1.1.1 / 1.1 小节
    const h3num = line.match(/^(\d+\.\d+(?:\.\d+)*)[.\s、．]+(.+)$/);
    if (h3num && h3num[1].includes(".")) {
      const dots = (h3num[1].match(/\./g) ?? []).length;
      pushHeading(dots >= 2 ? 3 : 2, h3num[2]);
      continue;
    }

    // 1. 大节 / 一、 / 第一章
    const h2cn = line.match(
      /^(?:第[一二三四五六七八九十百零\d]+[章节篇部]|[一二三四五六七八九十]+[、.．]|（[一二三四五六七八九十\d]+）|\d+[、.．])\s*(.+)$/
    );
    if (h2cn) {
      pushHeading(2, h2cn[1] || line);
      continue;
    }

    const h2simple = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (h2simple && !h2simple[1].includes(".")) {
      // 单独「1. xxx」当 h2
      pushHeading(2, h2simple[2]);
      continue;
    }

    // 首行当标题
    if (!usedH1 && outline.length === 0 && para.length === 0 && line.length <= 40) {
      pushHeading(1, line);
      continue;
    }

    para.push(line);
  }
  flushPara();

  if (!outline.length) {
    warnings.push("未识别到标题层级，已按段落导入；可用 Markdown 标题 # / ## 再导一次");
  }

  return {
    html: out.join("\n") || "<p></p>",
    outline,
    warnings,
  };
}

/** 规范化粘贴的 HTML：保留语义标签，去掉脚本样式 */
export function normalizePrdHtml(html: string): string {
  let s = html.trim();
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  // 若只有 body 片段，抽出
  const body = s.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (body) s = body[1];
  // 无块级标签时包一层
  if (!/<h[1-6]|<p|<ul|<ol|<table|<div/i.test(s)) {
    s = s
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("\n");
  }
  return s || "<p></p>";
}

export function previewPrdImport(
  raw: string,
  opts?: { titleHint?: string }
): PrdImportPreview {
  const format = detectPrdImportFormat(raw);
  const warnings: string[] = [];
  let html = "";
  let outline: PrdImportOutlineItem[] = [];

  if (format === "html") {
    html = normalizePrdHtml(raw);
    outline = outlineFromHtml(html);
    if (!outline.length) {
      warnings.push("HTML 中未找到 h1–h3，导入后可在编辑器里补标题");
    }
  } else if (format === "markdown") {
    html = markdownToPrdHtml(raw);
    outline = outlineFromHtml(html);
  } else {
    const plain = plainTextToPrdHtml(raw);
    html = plain.html;
    outline = plain.outline;
    warnings.push(...plain.warnings);
  }

  const fallback =
    opts?.titleHint?.trim() ||
    raw.trim().split(/\n/)[0]?.trim().slice(0, 40) ||
    "导入的 PRD";

  return {
    format,
    title: titleFromOutline(outline, fallback),
    outline,
    html,
    warnings,
  };
}
