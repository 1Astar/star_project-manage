import type { PrdDocVersion } from "@/lib/types";

export function nextPrdVersionLabel(versions: PrdDocVersion[]): string {
  if (!versions.length) return "1.0";
  const last = versions[versions.length - 1]?.label ?? "1.0";
  const match = last.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!match) return `1.0.${versions.length}`;
  const major = match[1];
  const minor = match[2];
  const patch = match[3] != null ? Number(match[3]) + 1 : 1;
  return `${major}.${minor}.${patch}`;
}

export function normalizePrdVersions(raw: unknown): PrdDocVersion[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      label: String(row.label ?? ""),
      html_content: String(row.html_content ?? ""),
      created_at: String(row.created_at ?? ""),
    };
  });
}
