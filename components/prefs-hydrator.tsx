"use client";

import { useEffect } from "react";
import { hydrateSyncedPrefs } from "@/lib/ui/synced-pref";

/** 登录后拉取全局 UI 偏好到 localStorage */
export function PrefsHydrator() {
  useEffect(() => {
    void hydrateSyncedPrefs();
  }, []);
  return null;
}
