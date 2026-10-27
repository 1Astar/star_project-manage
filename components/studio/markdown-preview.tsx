"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  extractMarkdownOutline,
  slugifyHeading,
  type OutlineItem,
} from "@/lib/wiki-pages/outline";

type MarkdownPreviewProps = {
  content: string;
  className?: string;
  /** 给 h1–h3 打锚点 id，供悬浮大纲跳转 */
  withHeadingIds?: boolean;
  /** 站内相对链接同页打开（如 /projects/.../pages/...） */
  preferInAppLinks?: boolean;
};

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textFromChildren).join("");
  if (children && typeof children === "object" && "props" in children) {
    const props = (children as { props?: { children?: ReactNode } }).props;
    return textFromChildren(props?.children);
  }
  return "";
}

/** 只读 Markdown 渲染（GFM：表格/任务列表/删除线等）。 */
export function MarkdownPreview({
  content,
  className,
  withHeadingIds = false,
  preferInAppLinks = false,
}: MarkdownPreviewProps) {
  const used = new Set<string>();
  const outline = withHeadingIds ? extractMarkdownOutline(content) : [];
  let headingCursor = 0;

  const heading =
    (Tag: "h1" | "h2" | "h3") =>
    ({ children }: { children?: ReactNode }) => {
      const text = textFromChildren(children).trim();
      let id: string | undefined;
      if (withHeadingIds && text) {
        const fromOutline = outline[headingCursor];
        if (fromOutline && fromOutline.text === text) {
          id = fromOutline.id;
          headingCursor += 1;
        } else {
          id = slugifyHeading(text, used);
        }
      }
      return (
        <Tag id={id} className="scroll-mt-24">
          {children}
        </Tag>
      );
    };

  const components: Components = {
    a: ({ href, children }) => {
      const url = href ?? "";
      const inApp =
        preferInAppLinks &&
        (url.startsWith("/") || url.startsWith("#")) &&
        !url.startsWith("//");
      if (inApp) {
        return (
          <Link href={url} className="text-indigo-600 underline">
            {children}
          </Link>
        );
      }
      return (
        <a href={url || undefined} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      );
    },
  };
  if (withHeadingIds) {
    components.h1 = heading("h1");
    components.h2 = heading("h2");
    components.h3 = heading("h3");
  }

  return (
    <div
      className={[
        "markdown-preview max-w-none text-sm leading-relaxed text-slate-800",
        "[&_h1]:mb-3 [&_h1]:mt-0 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900",
        "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900",
        "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold",
        "[&_p]:mb-3 [&_p]:whitespace-pre-wrap",
        "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:mb-1",
        "[&_a]:text-indigo-600 [&_a]:underline",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-600",
        "[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]",
        "[&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-3 [&_pre]:text-[12px] [&_pre]:text-slate-100",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit",
        "[&_table]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-xs",
        "[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-medium",
        "[&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1.5",
        "[&_hr]:my-4 [&_hr]:border-slate-200",
        className ?? "",
      ].join(" ")}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export type { OutlineItem };

export function looksLikeMarkdownAsset(opts: {
  title?: string | null;
  url?: string | null;
  mimeType?: string | null;
  storagePath?: string | null;
  note?: string | null;
}): boolean {
  const mime = (opts.mimeType || "").toLowerCase();
  if (mime.includes("markdown") || mime === "text/plain" || mime === "text/x-markdown") {
    if (mime.includes("markdown") || mime === "text/x-markdown") return true;
  }
  const path = `${opts.title || ""} ${opts.url || ""} ${opts.storagePath || ""}`.toLowerCase();
  if (/\.md(\?|#|$)/i.test(path) || path.includes("skill.md")) return true;
  const note = (opts.note || "").trim();
  if (note.length > 40 && (/^#{1,3}\s/m.test(note) || /\|.+\|/.test(note) || /```/.test(note))) {
    return true;
  }
  return false;
}
