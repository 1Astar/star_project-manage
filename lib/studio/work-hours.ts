/** 工时：由聊天开始/结束时间戳算出时长 */

export function workDurationMs(
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined
): number | null {
  if (!startedAt || !finishedAt) return null;
  const a = Date.parse(startedAt);
  const b = Date.parse(finishedAt);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return b - a;
}

export function formatWorkDuration(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return "—";
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) return "<1m";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatWorkRange(
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined
): string | null {
  if (!startedAt && !finishedAt) return null;
  const fmt = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return iso.slice(0, 16);
    }
  };
  if (startedAt && finishedAt) return `${fmt(startedAt)}–${fmt(finishedAt)}`;
  if (startedAt) return `${fmt(startedAt)}–`;
  return `–${fmt(finishedAt!)}`;
}

export function sumWorkDurationMs(
  ranges: Array<{ startedAt?: string | null; finishedAt?: string | null }>
): number {
  let total = 0;
  for (const r of ranges) {
    const ms = workDurationMs(r.startedAt, r.finishedAt);
    if (ms != null) total += ms;
  }
  return total;
}
