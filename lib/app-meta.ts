import packageJson from "@/package.json";

/** 与 CHANGELOG.md 当前条目同步 */
export const APP_RELEASE_DATE = "2026-07-18";

export const APP_VERSION = packageJson.version;

export const APP_COPYRIGHT = "© 刘星雨 Starry Product Lab";

export const APP_BRAND = "Starry Product Lab";

export function appVersionLabel() {
  return `v${APP_VERSION} · ${APP_RELEASE_DATE}`;
}
