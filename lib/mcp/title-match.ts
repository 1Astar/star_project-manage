/** Shared fuzzy title matching for shipped/changelog → requirement linking. */

export function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/✅|\[done\]/gi, "")
    .replace(/[\s\[\]【】·\-_/P0-3p]/g, "");
}

export function titlesSimilar(a: string, b: string): boolean {
  const x = normTitle(a);
  const y = normTitle(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return Math.min(x.length, y.length) >= 5;
  return false;
}

/** Extract bold lead from CHANGELOG bullet: `**能力名**：说明` → 能力名 */
export function changelogBulletLead(bullet: string): string {
  const m = bullet.match(/^\*\*(.+?)\*\*/);
  if (m?.[1]) return m[1].trim();
  const colon = bullet.split(/[：:]/)[0]?.trim();
  return (colon && colon.length < 40 ? colon : bullet).trim();
}

/** First line of commit message, with conventional-commit type prefix stripped. */
export function commitSubject(message: string): string {
  const first = (message.split("\n")[0] ?? message).trim();
  return first
    .replace(
      /^(feat|fix|docs|chore|refactor|test|perf|ci|build|style|revert)(\([^)]*\))?!?:\s*/i,
      ""
    )
    .trim();
}
