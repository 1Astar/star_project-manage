import type { NotionBlock, NotionClient, NotionRichText } from "@/lib/notion/client";

type RichPayload = {
  rich_text?: NotionRichText[];
  text?: NotionRichText[];
  checked?: boolean;
  language?: string;
  url?: string;
  caption?: NotionRichText[];
  icon?: { emoji?: string } | null;
};

function richToMd(parts: NotionRichText[] | undefined): string {
  return (parts ?? [])
    .map((p) => {
      let t = p.plain_text ?? "";
      const a = p.annotations;
      if (a?.code) t = `\`${t}\``;
      if (a?.bold) t = `**${t}**`;
      if (a?.italic) t = `*${t}*`;
      if (a?.strikethrough) t = `~~${t}~~`;
      if (p.href) t = `[${t}](${p.href})`;
      return t;
    })
    .join("");
}

function payload(block: NotionBlock): RichPayload {
  return (block[block.type] as RichPayload | undefined) ?? {};
}

function indent(depth: number): string {
  return "  ".repeat(Math.max(0, depth));
}

/**
 * 按树形结构把 Notion 子块转成 Markdown（保留标题/列表层级）。
 * 不递归拉 child_page 正文（只留链接占位）。
 */
export async function blocksChildrenToMarkdown(
  client: NotionClient,
  parentId: string,
  depth = 0
): Promise<string> {
  const blocks = await client.listBlockChildrenShallow(parentId);
  const lines: string[] = [];

  for (const block of blocks) {
    const p = payload(block);
    const text = richToMd(p.rich_text ?? p.text);
    const pad = indent(depth);

    switch (block.type) {
      case "paragraph":
        lines.push(text ? `${pad}${text}` : "");
        break;
      case "heading_1":
        lines.push(`${pad}# ${text}`);
        break;
      case "heading_2":
        lines.push(`${pad}## ${text}`);
        break;
      case "heading_3":
        lines.push(`${pad}### ${text}`);
        break;
      case "bulleted_list_item":
        lines.push(`${pad}- ${text}`);
        break;
      case "numbered_list_item":
        lines.push(`${pad}1. ${text}`);
        break;
      case "to_do":
        lines.push(`${pad}- [${p.checked ? "x" : " "}] ${text}`);
        break;
      case "quote":
        lines.push(`${pad}> ${text}`);
        break;
      case "callout": {
        const emoji = p.icon?.emoji ? `${p.icon.emoji} ` : "";
        lines.push(`${pad}> ${emoji}${text}`);
        break;
      }
      case "code": {
        const lang = p.language && p.language !== "plain text" ? p.language : "";
        lines.push(`${pad}\`\`\`${lang}`);
        lines.push(text);
        lines.push(`${pad}\`\`\``);
        break;
      }
      case "divider":
        lines.push(`${pad}---`);
        break;
      case "image": {
        const url =
          (block.image as { file?: { url?: string }; external?: { url?: string } } | undefined)
            ?.file?.url ??
          (block.image as { external?: { url?: string } } | undefined)?.external?.url ??
          "";
        const cap = richToMd(p.caption);
        if (url) lines.push(`${pad}![${cap || "image"}](${url})`);
        break;
      }
      case "bookmark":
      case "embed":
      case "link_preview": {
        const url =
          (block[block.type] as { url?: string } | undefined)?.url ?? p.url ?? "";
        if (url) lines.push(`${pad}[${text || url}](${url})`);
        break;
      }
      case "child_page": {
        const title =
          (block.child_page as { title?: string } | undefined)?.title ?? "子页面";
        lines.push(`${pad}- 📄 ${title}（Notion 子页，需单独导入）`);
        break;
      }
      case "toggle":
      case "synced_block":
      case "column_list":
      case "column":
      case "table":
      case "table_row":
        if (text) lines.push(`${pad}${text}`);
        break;
      default:
        if (text) lines.push(`${pad}${text}`);
        break;
    }

    if (
      block.has_children &&
      block.type !== "child_page" &&
      block.type !== "child_database"
    ) {
      const nested = await blocksChildrenToMarkdown(client, block.id, depth + 1);
      if (nested.trim()) lines.push(nested);
    }

    if (
      block.type === "paragraph" ||
      block.type.startsWith("heading_") ||
      block.type === "quote" ||
      block.type === "callout" ||
      block.type === "code" ||
      block.type === "divider"
    ) {
      lines.push("");
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
