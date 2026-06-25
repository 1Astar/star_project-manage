import { createHash, randomBytes } from "crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function calcProjectStats(
  tasks: Array<{ status: string }>
): {
  totalTasks: number;
  doneTasks: number;
  blockedTasks: number;
  testingTasks: number;
  acceptanceTasks: number;
  progressPercent: number;
} {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
  const testingTasks = tasks.filter((t) => t.status === "testing").length;
  const acceptanceTasks = tasks.filter((t) => t.status === "acceptance").length;
  const progressPercent =
    totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  return {
    totalTasks,
    doneTasks,
    blockedTasks,
    testingTasks,
    acceptanceTasks,
    progressPercent,
  };
}

export function parseFlexibleDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (!text || text === "`") return null;

  const cnMatch = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})/);
  if (cnMatch) {
    const [, y, m, d] = cnMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .slice(0, 60);
}
