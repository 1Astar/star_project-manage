import type { NotionBlock, NotionPage } from "@/lib/notion/client";

function richTexts(parts: { plain_text: string }[] | undefined): string {
  return (parts ?? []).map((p) => p.plain_text).join("").trim();
}

export function getPageTitle(page: NotionPage): string {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "title") return richTexts(prop.title);
  }
  return "未命名";
}

export function getPropertyText(page: NotionPage, ...names: string[]): string {
  for (const name of names) {
    const prop = page.properties[name];
    if (!prop) continue;
    if (prop.type === "title") return richTexts(prop.title);
    if (prop.type === "rich_text") return richTexts(prop.rich_text);
    if (prop.type === "select") return prop.select?.name ?? "";
    if (prop.type === "multi_select") return (prop.multi_select ?? []).map((s) => s.name).join("、");
    if (prop.type === "url") return prop.url ?? "";
    if (prop.type === "number" && prop.number != null) return String(prop.number);
    if (prop.type === "checkbox") return prop.checkbox ? "是" : "否";
    if (prop.type === "date") return prop.date?.start ?? "";
  }

  const lower = names.map((n) => n.toLowerCase());
  for (const [key, prop] of Object.entries(page.properties)) {
    if (!lower.some((n) => key.toLowerCase().includes(n))) continue;
    if (prop.type === "title") return richTexts(prop.title);
    if (prop.type === "rich_text") return richTexts(prop.rich_text);
    if (prop.type === "select") return prop.select?.name ?? "";
  }

  return "";
}

export function getPropertyRelationIds(page: NotionPage, ...names: string[]): string[] {
  for (const name of names) {
    const prop = page.properties[name];
    if (prop?.type === "relation") {
      return (prop.relation ?? []).map((r) => r.id);
    }
  }

  for (const [key, prop] of Object.entries(page.properties)) {
    if (prop.type !== "relation") continue;
    if (names.some((n) => key.includes(n))) {
      return (prop.relation ?? []).map((r) => r.id);
    }
  }

  return [];
}

function blockPlainText(block: NotionBlock): string {
  const payload = block[block.type] as { rich_text?: { plain_text: string }[]; text?: { plain_text: string }[] } | undefined;
  if (!payload) return "";
  const parts = payload.rich_text ?? payload.text;
  return richTexts(parts);
}

function blockLines(block: NotionBlock): string[] {
  const text = blockPlainText(block);
  if (!text) return [];

  if (block.type === "bulleted_list_item" || block.type === "numbered_list_item") {
    return [`• ${text}`];
  }
  if (block.type === "to_do") {
    const checked = (block.to_do as { checked?: boolean })?.checked;
    return [`${checked ? "☑" : "☐"} ${text}`];
  }

  return [text];
}

export function blocksToPlainText(blocks: NotionBlock[]): string {
  return blocks
    .flatMap((b) => blockLines(b))
    .filter(Boolean)
    .join("\n")
    .trim();
}

const BODY_SECTION_ALIASES: Record<string, string[]> = {
  initialThought: ["初始想法", "最初想法", "灵感来源"],
  whyThought: ["为什么有这个想法", "为什么想到", "为什么"],
  positioning: ["产品定位", "定位"],
  iterations: ["后续迭代", "迭代计划", "版本规划"],
  done: ["已做", "已完成", "做了啥"],
  notDone: ["未做", "停车", "不做", "暂缓"],
  nextStep: ["当前下一步", "下一步", "接下来"],
  links: ["相关链接", "链接", "参考资料"],
  retrospectives: ["复盘记录", "复盘", "回顾"],
};

export function parseProjectBodyFromBlocks(blocks: NotionBlock[]): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentKey: string | null = null;
  const buffer: string[] = [];

  const flush = () => {
    if (currentKey && buffer.length) {
      sections[currentKey] = buffer.join("\n").trim();
    }
    buffer.length = 0;
  };

  for (const block of blocks) {
    const headingTypes = ["heading_1", "heading_2", "heading_3"];
    if (headingTypes.includes(block.type)) {
      flush();
      const heading = blockPlainText(block);
      currentKey = null;
      for (const [key, aliases] of Object.entries(BODY_SECTION_ALIASES)) {
        if (aliases.some((a) => heading.includes(a))) {
          currentKey = key;
          break;
        }
      }
      continue;
    }

    if (!currentKey) continue;
    buffer.push(...blockLines(block));
  }

  flush();
  return sections;
}

export function matchSelect<T extends string>(
  raw: string,
  map: Record<string, T>,
  fallback: T
): T {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return fallback;

  for (const [key, value] of Object.entries(map)) {
    if (normalized === key.toLowerCase() || normalized.includes(key.toLowerCase())) {
      return value;
    }
  }
  return fallback;
}
