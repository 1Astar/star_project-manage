"use client";

import { useEffect, useRef } from "react";

type Props = {
  count: number;
  todayDay: string;
};

/**
 * When workbench has pending acceptance items, ask for Notification permission
 * once and fire a browser nudge (deduped per day via localStorage).
 */
export function WorkbenchAcceptanceBrowserNudge({ count, todayDay }: Props) {
  const asked = useRef(false);

  useEffect(() => {
    if (count <= 0 || typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    const key = `star-pm-acceptance-nudge:${todayDay}`;
    if (localStorage.getItem(key) === "1") return;

    async function run() {
      if (asked.current) return;
      asked.current = true;
      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
      }
      if (perm !== "granted") return;
      try {
        new Notification(`Star PM · 待验收 ${count} 项`, {
          body: "打开工作台「待你验收」点通过或退回。",
          tag: `acceptance-${todayDay}`,
        });
        localStorage.setItem(key, "1");
      } catch {
        /* ignore */
      }
    }

    void run();
  }, [count, todayDay]);

  return null;
}
