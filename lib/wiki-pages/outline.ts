/** 从 Markdown / 纯文本提取大纲标题（#～### 或「## 标题」） */

export type OutlineItem = {
  id: string;
  text: string;
  level: 1 | 2 | 3;
};

export function slugifyHeading(text: string, used: Set<string>): string {
  const base =
    text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u4e00-\u9fff-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section";
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n++}`;
  }
  used.add(id);
  return id;
}

/** 解析 Markdown 标题行；忽略代码块内的 # */
export function extractMarkdownOutline(content: string): OutlineItem[] {
  const lines = (content ?? "").split(/\r?\n/);
  const used = new Set<string>();
  const items: OutlineItem[] = [];
  let inFence = false;

  for (const line of lines) {
    const fence = line.match(/^(`{3,}|~{3,})/);
    if (fence) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (!m) continue;
    const level = m[1].length as 1 | 2 | 3;
    const text = m[2].replace(/#+\s*$/, "").trim();
    if (!text) continue;
    items.push({ id: slugifyHeading(text, used), text, level });
  }
  return items;
}

export function mergeOutline(
  ...groups: Array<OutlineItem[] | OutlineItem | null | undefined>
): OutlineItem[] {
  const used = new Set<string>();
  const out: OutlineItem[] = [];
  for (const g of groups) {
    if (!g) continue;
    const list = Array.isArray(g) ? g : [g];
    for (const item of list) {
      let id = item.id;
      if (used.has(id)) id = slugifyHeading(item.text || id, used);
      else used.add(id);
      out.push({ ...item, id });
    }
  }
  return out;
}
