/**
 * VS Code 风左右对比：按行 LCS + 同行内字符级高亮。
 */

export type DiffCellKind = "equal" | "add" | "del" | "change" | "spacer";

export type DiffSpan = { text: string; changed: boolean };

export type DiffSideCell = {
  kind: DiffCellKind;
  lineNo: number | null;
  text: string;
  spans?: DiffSpan[];
};

export type DiffRow = {
  left: DiffSideCell;
  right: DiffSideCell;
};

/** @deprecated 用 DiffSideCell */
export type DiffCell = DiffSideCell;
/** @deprecated */
export type DiffSide = DiffCellKind;

function splitLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized) return [];
  return normalized.split("\n");
}

function marksToSpans(text: string, marks: boolean[]): DiffSpan[] {
  if (!text) return [{ text: "", changed: false }];
  const spans: DiffSpan[] = [];
  let buf = "";
  let marked = marks[0] ?? false;
  const flush = () => {
    if (!buf && spans.length) return;
    spans.push({ text: buf || "", changed: marked });
    buf = "";
  };
  for (let i = 0; i < text.length; i++) {
    const m = marks[i] ?? false;
    if (i > 0 && m !== marked) {
      flush();
      marked = m;
    }
    buf += text[i];
  }
  flush();
  return spans;
}

function markCharDiff(
  a: string,
  b: string
): { leftMarks: boolean[]; rightMarks: boolean[] } {
  const n = a.length;
  const m = b.length;
  if (n * m > 80_000) {
    return {
      leftMarks: Array(n).fill(true),
      rightMarks: Array(m).fill(true),
    };
  }
  const dp: Uint16Array[] = Array.from(
    { length: n + 1 },
    () => new Uint16Array(m + 1)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const leftMarks = Array(n).fill(false);
  const rightMarks = Array(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      leftMarks[i] = true;
      i += 1;
    } else {
      rightMarks[j] = true;
      j += 1;
    }
  }
  while (i < n) {
    leftMarks[i] = true;
    i += 1;
  }
  while (j < m) {
    rightMarks[j] = true;
    j += 1;
  }
  return { leftMarks, rightMarks };
}

export function buildSideBySideDiff(
  previousText: string,
  currentText: string
): DiffRow[] {
  const prev = splitLines(previousText);
  const curr = splitLines(currentText);
  const n = prev.length;
  const m = curr.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0)
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        prev[i] === curr[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  type Op =
    | { t: "eq"; i: number; j: number }
    | { t: "del"; i: number }
    | { t: "add"; j: number };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (prev[i] === curr[j]) {
      ops.push({ t: "eq", i, j });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ t: "del", i });
      i += 1;
    } else {
      ops.push({ t: "add", j });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ t: "del", i });
    i += 1;
  }
  while (j < m) {
    ops.push({ t: "add", j });
    j += 1;
  }

  const rows: DiffRow[] = [];
  let k = 0;
  while (k < ops.length) {
    const op = ops[k]!;
    if (op.t === "eq") {
      rows.push({
        left: { kind: "equal", lineNo: op.i + 1, text: prev[op.i]! },
        right: { kind: "equal", lineNo: op.j + 1, text: curr[op.j]! },
      });
      k += 1;
      continue;
    }
    if (op.t === "del") {
      const dels: number[] = [];
      while (k < ops.length && ops[k]!.t === "del") {
        dels.push((ops[k] as { t: "del"; i: number }).i);
        k += 1;
      }
      const adds: number[] = [];
      while (k < ops.length && ops[k]!.t === "add") {
        adds.push((ops[k] as { t: "add"; j: number }).j);
        k += 1;
      }
      const pair = Math.min(dels.length, adds.length);
      for (let p = 0; p < pair; p++) {
        const li = dels[p]!;
        const rj = adds[p]!;
        const a = prev[li]!;
        const b = curr[rj]!;
        const { leftMarks, rightMarks } = markCharDiff(a, b);
        rows.push({
          left: {
            kind: "change",
            lineNo: li + 1,
            text: a,
            spans: marksToSpans(a, leftMarks),
          },
          right: {
            kind: "change",
            lineNo: rj + 1,
            text: b,
            spans: marksToSpans(b, rightMarks),
          },
        });
      }
      for (let p = pair; p < dels.length; p++) {
        const li = dels[p]!;
        rows.push({
          left: { kind: "del", lineNo: li + 1, text: prev[li]! },
          right: { kind: "spacer", lineNo: null, text: "" },
        });
      }
      for (let p = pair; p < adds.length; p++) {
        const rj = adds[p]!;
        rows.push({
          left: { kind: "spacer", lineNo: null, text: "" },
          right: { kind: "add", lineNo: rj + 1, text: curr[rj]! },
        });
      }
      continue;
    }
    rows.push({
      left: { kind: "spacer", lineNo: null, text: "" },
      right: { kind: "add", lineNo: op.j + 1, text: curr[op.j]! },
    });
    k += 1;
  }
  return rows;
}

export function htmlToDiffText(html: string): string {
  const trimmed = (html || "").trim();
  if (!trimmed) return "";
  let s = trimmed
    .replace(/<\/(h[1-6]|p|li|tr|div|blockquote|pre|section|article)>/gi, "</$1>\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(ul|ol|table)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
