/** 客户端：localStorage ↔ /api/studio/app-settings 同步 */

const META_PREFIX = "star-pm:pref-meta:";
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export type SyncedPrefMeta = { updatedAt: string };

function metaKey(syncKey: string) {
  return `${META_PREFIX}${syncKey}`;
}

export function readLocalPref<T>(localKey: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(localKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLocalPref(localKey: string, value: unknown, syncKey?: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(localKey, JSON.stringify(value));
  if (syncKey) {
    const updatedAt = new Date().toISOString();
    window.localStorage.setItem(metaKey(syncKey), JSON.stringify({ updatedAt }));
    pushSyncedPref(syncKey, value, updatedAt);
  }
}

export function pushSyncedPref(syncKey: string, value: unknown, updatedAt?: string) {
  if (typeof window === "undefined") return;
  const at = updatedAt ?? new Date().toISOString();
  window.localStorage.setItem(metaKey(syncKey), JSON.stringify({ updatedAt: at }));

  const prev = timers.get(syncKey);
  if (prev) clearTimeout(prev);
  timers.set(
    syncKey,
    setTimeout(() => {
      timers.delete(syncKey);
      void fetch("/api/studio/app-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: syncKey, value }),
      }).catch(() => {
        /* ignore offline / viewer */
      });
    }, 400)
  );
}

export const SYNC_PREF_KEYS = [
  "project-library-col-widths",
  "project-library-order",
  "workbench-library-v1",
  "req-board-views-v1",
  "idea-table-widths-v1",
  "pool-col-widths",
] as const;

export type SyncPrefKey = (typeof SYNC_PREF_KEYS)[number];

/** localStorage key ↔ sync key */
export const LOCAL_TO_SYNC: Record<string, SyncPrefKey> = {
  "star-pm:project-library-col-widths": "project-library-col-widths",
  "star-pm:project-library-order": "project-library-order",
  "star-pm:workbench-library-v1": "workbench-library-v1",
  "star-pm:req-board-views-v1": "req-board-views-v1",
  "star-pm:idea-table-widths-v1": "idea-table-widths-v1",
};

export function poolWidthsLocalKey(projectId: string) {
  return `star-pm:pool-col-widths:${projectId}`;
}

/** 从服务端拉取并覆盖本地（远程较新时） */
export async function hydrateSyncedPrefs(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch(
      `/api/studio/app-settings?keys=${SYNC_PREF_KEYS.join(",")}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      settings?: Array<{ key: string; value: unknown; updatedAt: string }>;
    };
    for (const row of data.settings ?? []) {
      const localKey =
        Object.entries(LOCAL_TO_SYNC).find(([, sk]) => sk === row.key)?.[0] ?? null;

      if (row.key === "pool-col-widths" && row.value && typeof row.value === "object") {
        const map = row.value as Record<string, Record<string, number>>;
        for (const [projectId, widths] of Object.entries(map)) {
          if (!projectId || !widths || typeof widths !== "object") continue;
          window.localStorage.setItem(
            poolWidthsLocalKey(projectId),
            JSON.stringify(widths)
          );
        }
        window.localStorage.setItem(
          metaKey(row.key),
          JSON.stringify({ updatedAt: row.updatedAt })
        );
        continue;
      }

      if (!localKey) continue;
      const metaRaw = window.localStorage.getItem(metaKey(row.key));
      let localAt = "";
      try {
        localAt = metaRaw ? (JSON.parse(metaRaw) as SyncedPrefMeta).updatedAt : "";
      } catch {
        localAt = "";
      }
      if (localAt && localAt >= row.updatedAt) continue;
      window.localStorage.setItem(localKey, JSON.stringify(row.value));
      window.localStorage.setItem(
        metaKey(row.key),
        JSON.stringify({ updatedAt: row.updatedAt })
      );
    }
    window.dispatchEvent(new Event("star-pm:prefs-hydrated"));
  } catch {
    /* ignore */
  }
}

/** 写入某项目的 pool 列宽，并合并进 pool-col-widths 同步包 */
export function writePoolColWidthsSynced(
  projectId: string,
  widths: Record<string, number>
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(poolWidthsLocalKey(projectId), JSON.stringify(widths));
  const bundle: Record<string, Record<string, number>> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k?.startsWith("star-pm:pool-col-widths:")) continue;
    const pid = k.slice("star-pm:pool-col-widths:".length);
    try {
      const parsed = JSON.parse(window.localStorage.getItem(k) ?? "{}") as Record<
        string,
        number
      >;
      bundle[pid] = parsed;
    } catch {
      /* ignore */
    }
  }
  bundle[projectId] = widths;
  pushSyncedPref("pool-col-widths", bundle);
}
