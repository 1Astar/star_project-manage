function splitBlocks(html: string): string[] {
  const trimmed = html.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/(?=<(?:h[1-6]|p|ul|ol|table|blockquote|pre|div|hr|label)\b)/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function markBlock(html: string, className: string): string {
  const match = html.match(/^<([a-zA-Z0-9]+)(\s[^>]*)?>/);
  if (!match) {
    return `<div class="${className}">${html}</div>`;
  }
  const tag = match[1];
  const attrs = match[2] ?? "";
  if (/\bclass=/.test(attrs)) {
    return html.replace(/\bclass=(['"])(.*?)\1/, (_all, quote, value) => {
      return `class=${quote}${value} ${className}${quote}`;
    });
  }
  return html.replace(new RegExp(`^<${tag}`), `<${tag} class="${className}"`);
}

/** 相对上一小版本，给当前 HTML 块做增/删标注（不写回存储） */
export function annotateHtmlDiff(previousHtml: string, currentHtml: string): string {
  const previous = splitBlocks(previousHtml);
  const current = splitBlocks(currentHtml);
  if (!previous.length) return currentHtml;

  const n = previous.length;
  const m = current.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        stripTags(previous[i]) === stripTags(current[j])
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (stripTags(previous[i]) === stripTags(current[j])) {
      out.push(current[j]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push(markBlock(previous[i], "prd-rev-del"));
      i += 1;
    } else {
      out.push(markBlock(current[j], "prd-rev-add"));
      j += 1;
    }
  }
  while (i < n) {
    out.push(markBlock(previous[i], "prd-rev-del"));
    i += 1;
  }
  while (j < m) {
    out.push(markBlock(current[j], "prd-rev-add"));
    j += 1;
  }
  return out.join("");
}
