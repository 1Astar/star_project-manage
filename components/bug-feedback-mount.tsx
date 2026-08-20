"use client";

import { useEffect } from "react";

type BugFeedbackMountProps = {
  token: string;
  version?: string;
  offsetRight?: string;
  offsetBottom?: string;
};

/** 站内挂载公开反馈 Widget（依赖 /bug-feedback-widget.js） */
export function BugFeedbackMount({
  token,
  version,
  offsetRight = "16",
  offsetBottom = "16",
}: BugFeedbackMountProps) {
  useEffect(() => {
    if (!token) return;

    const w = window as Window & {
      StarPmBugFeedback?: {
        mount: (opts: Record<string, string>) => () => void;
      };
    };

    let dispose: (() => void) | undefined;
    let script = document.querySelector<HTMLScriptElement>(
      'script[data-star-bug-feedback-loader="1"]'
    );

    const run = () => {
      dispose?.();
      dispose = w.StarPmBugFeedback?.mount({
        token,
        endpoint: "/api/public/bug-feedback",
        version: version || "",
        label: "反馈",
        offsetRight,
        offsetBottom,
      });
    };

    if (w.StarPmBugFeedback?.mount) {
      run();
      return () => dispose?.();
    }

    if (!script) {
      script = document.createElement("script");
      script.src = "/bug-feedback-widget.js";
      script.async = true;
      script.dataset.starBugFeedbackLoader = "1";
      document.body.appendChild(script);
    }

    script.addEventListener("load", run);
    return () => {
      script?.removeEventListener("load", run);
      dispose?.();
    };
  }, [token, version, offsetRight, offsetBottom]);

  return null;
}
