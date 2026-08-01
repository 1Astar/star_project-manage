/**
 * PushPlus 微信推送：https://www.pushplus.plus/
 * Env: PUSHPLUS_TOKEN（控制台拿到的 token）
 */

export type PushPlusResult =
  | { ok: true; skipped?: false; data?: unknown }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

export function getPushPlusToken(): string | null {
  const t = process.env.PUSHPLUS_TOKEN?.trim();
  return t || null;
}

export async function sendPushPlus(input: {
  title: string;
  content: string;
  /** 默认 wechat；也可 webhook / mail 等 */
  channel?: string;
  template?: "html" | "txt" | "json" | "markdown";
}): Promise<PushPlusResult> {
  const token = getPushPlusToken();
  if (!token) {
    return { ok: true, skipped: true, reason: "PUSHPLUS_TOKEN 未配置" };
  }

  const title = input.title.trim().slice(0, 100) || "Star PM";
  const content = input.content.trim() || title;

  try {
    const res = await fetch("https://www.pushplus.plus/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        title,
        content,
        template: input.template ?? "txt",
        channel: input.channel ?? "wechat",
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      code?: number;
      msg?: string;
      data?: unknown;
    } | null;
    if (!res.ok || (data?.code !== undefined && data.code !== 200)) {
      return {
        ok: false,
        error: data?.msg || `PushPlus HTTP ${res.status}`,
      };
    }
    return { ok: true, data: data?.data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "PushPlus 请求失败",
    };
  }
}
