import packageJson from "@/package.json";

/** 与 CHANGELOG.md 当前条目同步 */
export const APP_RELEASE_DATE = "2026-08-19";

export const APP_VERSION = packageJson.version;

export const APP_COPYRIGHT = "© Starry Studio";

export const APP_BRAND = "Starry Studio";

/** 品牌站 / 作品集域名 */
export const APP_SITE_URL = "https://starry-studio.cn";

export function appVersionLabel() {
  return `v${APP_VERSION} · ${APP_RELEASE_DATE}`;
}
