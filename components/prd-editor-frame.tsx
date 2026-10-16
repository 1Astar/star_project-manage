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

export function PrdEditorFrame({
  brand,
  section,
  html,
  pages,
  activeId,
  editable,
  review,
  revision,
  highlightTick = 0,
  onHtmlChange,
  onSelectText,
}: {
  brand: string;
  section: string;
  html: string;
  pages: PrdHostPage[];
  activeId: string;
  editable: boolean;
  review: boolean;
  revision: string;
  highlightTick?: number;
  onHtmlChange?: (html: string, title: string) => void;
  onSelectText?: (text: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const payloadRef = useRef({ brand, section, html, pages, activeId, editable, review });
  payloadRef.current = { brand, section, html, pages, activeId, editable, review };
  const changeRef = useRef(onHtmlChange);
  changeRef.current = onHtmlChange;
  const selectRef = useRef(onSelectText);
  selectRef.current = onSelectText;

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
        changeRef.current?.(String(event.data.html ?? ""), String(event.data.title ?? ""));
      }
      if (event.data?.type === "STAR_PRD_SELECTION") {
        selectRef.current?.(String(event.data.text ?? ""));
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
