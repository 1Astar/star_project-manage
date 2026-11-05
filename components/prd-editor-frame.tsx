"use client";

import { useEffect, useRef } from "react";

export type PrdHostPage = {
  id: string;
  title: string;
  parentId: string | null;
  order: number;
  expanded: boolean;
  content: string;
  prototypeUrl?: string;
};

export type PrdHostComment = {
  id: string;
  quote: string;
  text: string;
  createdAt?: string;
  unread?: boolean;
  replies?: Array<{ id: string; text: string; createdAt?: string }>;
};

export type PrdHostVersion = {
  id: string;
  label: string;
  created_at?: string;
};

export type PrdHtmlChangeMeta = {
  activeId?: string;
  pages?: PrdHostPage[];
};

export function PrdEditorFrame({
  brand,
  section,
  html,
  pages,
  activeId,
  editable,
  review,
  comments = [],
  versions = [],
  viewVersionId = "current",
  revision,
  highlightTick = 0,
  commentsOpenTick = 0,
  onHtmlChange,
  onCommentsChange,
  onHostCreatePage,
  onHostLinkPrototype,
  onVersionChange,
}: {
  brand: string;
  section: string;
  html: string;
  pages: PrdHostPage[];
  activeId: string;
  editable: boolean;
  review: boolean;
  comments?: PrdHostComment[];
  versions?: PrdHostVersion[];
  viewVersionId?: string | "current";
  revision: string;
  highlightTick?: number;
  commentsOpenTick?: number;
  onHtmlChange?: (html: string, title: string, meta?: PrdHtmlChangeMeta) => void;
  onCommentsChange?: (comments: PrdHostComment[]) => void;
  onHostCreatePage?: (title: string) => void;
  onHostLinkPrototype?: () => void;
  onVersionChange?: (versionId: string | "current") => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const payloadRef = useRef({
    brand,
    section,
    html,
    pages,
    activeId,
    editable,
    review,
    comments,
    versions,
    viewVersionId,
  });
  payloadRef.current = {
    brand,
    section,
    html,
    pages,
    activeId,
    editable,
    review,
    comments,
    versions,
    viewVersionId,
  };
  const changeRef = useRef(onHtmlChange);
  changeRef.current = onHtmlChange;
  const commentsRef = useRef(onCommentsChange);
  commentsRef.current = onCommentsChange;
  const hostCreateRef = useRef(onHostCreatePage);
  hostCreateRef.current = onHostCreatePage;
  const hostLinkProtoRef = useRef(onHostLinkPrototype);
  hostLinkProtoRef.current = onHostLinkPrototype;
  const versionRef = useRef(onVersionChange);
  versionRef.current = onVersionChange;
  const copyWaitRef = useRef<{
    resolve: (v: { html: string; text: string }) => void;
    reject: (e: Error) => void;
  } | null>(null);

  function postLoad() {
    const win = iframeRef.current?.contentWindow;
    if (!win || !readyRef.current) return;
    win.postMessage({ type: "STAR_PRD_LOAD", ...payloadRef.current }, "*");
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "STAR_PRD_READY") {
        readyRef.current = true;
        postLoad();
      }
      if (event.data?.type === "STAR_PRD_CHANGE") {
        const pagesPayload = Array.isArray(event.data.pages)
          ? (event.data.pages as PrdHostPage[])
          : undefined;
        changeRef.current?.(
          String(event.data.html ?? ""),
          String(event.data.title ?? ""),
          {
            activeId: event.data.activeId
              ? String(event.data.activeId)
              : undefined,
            pages: pagesPayload,
          }
        );
        if (Array.isArray(event.data.comments)) {
          commentsRef.current?.(event.data.comments as PrdHostComment[]);
        }
      }
      if (event.data?.type === "STAR_PRD_VERSION") {
        versionRef.current?.(
          (event.data.versionId as string | "current") || "current"
        );
      }
      if (event.data?.type === "STAR_PRD_COPY_PAYLOAD") {
        const wait = copyWaitRef.current;
        copyWaitRef.current = null;
        if (!wait) return;
        if (event.data.error) {
          wait.reject(new Error("复制失败"));
          return;
        }
        wait.resolve({
          html: String(event.data.html ?? ""),
          text: String(event.data.text ?? ""),
        });
      }
      if (event.data?.type === "STAR_PRD_HOST_CREATE_PAGE") {
        // 兼容旧壳：现已改为壳内同文档加页；若仍收到则忽略新建整份 PRD
        hostCreateRef.current?.(String(event.data.title ?? "未命名 PRD"));
      }
      if (event.data?.type === "STAR_PRD_HOST_LINK_PROTOTYPE") {
        hostLinkProtoRef.current?.();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const el = iframeRef.current as HTMLIFrameElement & {
      __copyPage?: () => Promise<{ html: string; text: string }>;
    } | null;
    if (!el) return;
    el.__copyPage = () =>
      new Promise((resolve, reject) => {
        const win = el.contentWindow;
        if (!win) {
          reject(new Error("编辑器未就绪"));
          return;
        }
        copyWaitRef.current = { resolve, reject };
        win.postMessage({ type: "STAR_PRD_COPY_PAGE" }, "*");
        window.setTimeout(() => {
          if (copyWaitRef.current) {
            copyWaitRef.current.reject(new Error("复制超时"));
            copyWaitRef.current = null;
          }
        }, 3000);
      });
  });

  useEffect(() => {
    postLoad();
  }, [revision]);

  useEffect(() => {
    if (!highlightTick) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "STAR_PRD_HIGHLIGHT" },
      "*"
    );
  }, [highlightTick]);

  useEffect(() => {
    if (!commentsOpenTick) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "STAR_PRD_COMMENTS_OPEN", on: true },
      "*"
    );
  }, [commentsOpenTick]);

  return (
    <iframe
      ref={iframeRef}
      title="PRD 编辑器"
      src={`/prd-shell/viewer.html?host=1${editable ? "" : "&readonly=1"}`}
      className="h-full min-h-[70vh] w-full border-0 bg-white"
      onLoad={() => {
        readyRef.current = true;
        postLoad();
      }}
    />
  );
}
