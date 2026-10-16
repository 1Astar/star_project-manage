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

export function PrdEditorFrame({
  brand,
  section,
  html,
  pages,
  activeId,
  editable,
  review,
  comments = [],
  revision,
  highlightTick = 0,
  commentsOpenTick = 0,
  onHtmlChange,
  onCommentsChange,
}: {
  brand: string;
  section: string;
  html: string;
  pages: PrdHostPage[];
  activeId: string;
  editable: boolean;
  review: boolean;
  comments?: PrdHostComment[];
  revision: string;
  highlightTick?: number;
  commentsOpenTick?: number;
  onHtmlChange?: (html: string, title: string) => void;
  onCommentsChange?: (comments: PrdHostComment[]) => void;
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
  };
  const changeRef = useRef(onHtmlChange);
  changeRef.current = onHtmlChange;
  const commentsRef = useRef(onCommentsChange);
  commentsRef.current = onCommentsChange;

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
        changeRef.current?.(
          String(event.data.html ?? ""),
          String(event.data.title ?? "")
        );
        if (Array.isArray(event.data.comments)) {
          commentsRef.current?.(event.data.comments as PrdHostComment[]);
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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
