/**
 * PRD 正文 HTML → 兼容常见 Markdown（GFM 表格、嵌套列表）的纯文本。
 * 只认语义标签；忽略编辑壳控件类名。
 */

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n+/g, "<br>");
}

function inlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return decodeEntities(node.textContent || "").replace(/\s+/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = [...el.childNodes].map(inlineMarkdown).join("");
  if (tag === "br") return "  \n";
  if (tag === "strong" || tag === "b") return `**${inner.trim()}**`;
  if (tag === "em" || tag === "i") return `*${inner.trim()}*`;
  if (tag === "s" || tag === "del" || tag === "strike") return `~~${inner.trim()}~~`;
  if (tag === "code") return `\`${inner.trim()}\``;
  if (tag === "a") {
    const href = el.getAttribute("href") || "";
    return href ? `[${inner.trim()}](${href})` : inner;
  }
  if (tag === "mark") return inner;
  return inner;
}

function listMarkdown(list: HTMLElement, ordered: boolean, depth: number): string {
  const indent = "    ".repeat(depth);
  const items = [...list.children].filter(
    (c) => (c as HTMLElement).tagName?.toLowerCase() === "li"
  ) as HTMLElement[];
  return items
    .map((li, index) => {
      const marker = ordered ? `${index + 1}.` : "-";
      const parts: string[] = [];
      let line = "";
      let headWritten = false;
      const flushHead = () => {
        if (headWritten) return;
        parts.push(`${indent}${marker} ${line.trim()}`);
        line = "";
        headWritten = true;
      };
      for (const child of [...li.childNodes]) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = (child as HTMLElement).tagName.toLowerCase();
          if (tag === "ul" || tag === "ol") {
            flushHead();
            parts.push(listMarkdown(child as HTMLElement, tag === "ol", depth + 1));
            continue;
          }
        }
        line += inlineMarkdown(child);
      }
      if (!headWritten) flushHead();
      return parts.join("\n");
    })
    .join("\n");
}

function tableMarkdown(table: HTMLElement): string {
  const rows = [...table.querySelectorAll("tr")];
  if (!rows.length) return "";
  const matrix = rows.map((tr) =>
    [...tr.children]
      .filter((c) => /^(th|td)$/i.test((c as HTMLElement).tagName))
      .map((c) => escapeCell(inlineMarkdown(c).trim()))
  );
  const width = Math.max(...matrix.map((r) => r.length), 1);
  const norm = matrix.map((r) => {
    const next = [...r];
    while (next.length < width) next.push("");
    return next;
  });
  const header = norm[0];
  const sep = header.map(() => "---");
  const body = norm.slice(1);
  return [
    `| ${header.join(" | ")} |`,
    `| ${sep.join(" | ")} |`,
    ...body.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

function blockMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = decodeEntities(node.textContent || "").trim();
    return t;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === "script" || tag === "style") return "";
  if (tag === "h1") return `# ${inlineMarkdown(el).trim()}`;
  if (tag === "h2") return `## ${inlineMarkdown(el).trim()}`;
  if (tag === "h3") return `### ${inlineMarkdown(el).trim()}`;
  if (tag === "h4") return `#### ${inlineMarkdown(el).trim()}`;
  if (tag === "p") return inlineMarkdown(el).trim();
  if (tag === "hr") return "---";
  if (tag === "blockquote") {
    return inlineMarkdown(el)
      .trim()
      .split(/\n/)
      .map((line) => `> ${line}`)
      .join("\n");
  }
  if (tag === "pre") {
    const code = el.textContent || "";
    return `\`\`\`\n${code.replace(/\n$/, "")}\n\`\`\``;
  }
  if (tag === "ul") return listMarkdown(el, false, 0);
  if (tag === "ol") return listMarkdown(el, true, 0);
  if (tag === "table") return tableMarkdown(el);
  if (tag === "div" || tag === "section" || tag === "main" || tag === "article") {
    return [...el.childNodes]
      .map(blockMarkdown)
      .filter(Boolean)
      .join("\n\n");
  }
  return inlineMarkdown(el).trim();
}

/** 将 PRD 正文 HTML（片段或整页）转为 Markdown 字符串 */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(
    `<div id="root">${html}</div>`,
    "text/html"
  );
  const root = doc.getElementById("root");
  if (!root) return "";
  const blocks = [...root.childNodes]
    .map(blockMarkdown)
    .map((b) => b.trim())
    .filter(Boolean);
  return `${blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function downloadTextFile(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safe = filename.replace(/[\\/:*?"<>|]+/g, "_").trim() || "prd";
  a.href = url;
  a.download = safe;
  a.click();
  URL.revokeObjectURL(url);
}
