import { NextResponse } from "next/server";
import {
  assertOwnerSecret,
  clientAcceptsRedirect,
  getClient,
  isAllowedRedirect,
  randomToken,
  saveAuthCode,
} from "@/lib/mcp/oauth/store";

export const runtime = "nodejs";

function htmlPage(body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Star PM MCP 授权</title><style>
body{font-family:Microsoft YaHei,sans-serif;background:#0f1419;color:#e7ecf3;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{width:min(420px,92vw);background:#1a222c;border:1px solid #2c3642;border-radius:12px;padding:28px}
h1{font-size:20px;margin:0 0 8px}
p{color:#9aa7b5;font-size:14px;line-height:1.5}
label{display:block;margin:16px 0 6px;font-size:13px;color:#c5d0db}
input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #3a4654;background:#0f1419;color:#fff}
button{margin-top:18px;width:100%;padding:11px;border:0;border-radius:8px;background:#3b82f6;color:#fff;font-weight:600;cursor:pointer}
.err{color:#f87171;font-size:13px;margin-top:10px}
</style></head><body><div class="card">${body}</div></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

function readParams(source: URLSearchParams | FormData) {
  const get = (k: string) => {
    const v = source instanceof URLSearchParams ? source.get(k) : source.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    client_id: get("client_id"),
    redirect_uri: get("redirect_uri"),
    response_type: get("response_type") || "code",
    state: get("state"),
    scope: get("scope") || "star-pm:read star-pm:write",
    code_challenge: get("code_challenge"),
    code_challenge_method: get("code_challenge_method") || "S256",
    secret: get("secret"),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const p = readParams(url.searchParams);

  if (!p.client_id || !p.redirect_uri || !p.code_challenge) {
    return htmlPage("<h1>缺少 OAuth 参数</h1><p>需要 client_id / redirect_uri / code_challenge</p>", 400);
  }
  if (p.response_type !== "code") {
    return htmlPage("<h1>不支持的 response_type</h1>", 400);
  }
  if (p.code_challenge_method !== "S256") {
    return htmlPage("<h1>仅支持 PKCE S256</h1>", 400);
  }
  if (!isAllowedRedirect(p.redirect_uri)) {
    return htmlPage("<h1>redirect_uri 不被允许</h1>", 400);
  }

  const client = await getClient(p.client_id);
  if (!client) {
    return htmlPage(
      "<h1>未知 client_id</h1><p>请先完成 Dynamic Client Registration，或在 ChatGPT 里用 DCR 重新创建连接。</p>",
      400
    );
  }
  if (!clientAcceptsRedirect(client, p.redirect_uri)) {
    return htmlPage("<h1>redirect_uri 未注册到该 client</h1>", 400);
  }

  const qs = url.searchParams.toString();
  return htmlPage(`
    <h1>授权 Star PM MCP</h1>
    <p>ChatGPT 正在请求访问灵感/任务工具。输入 Vercel 环境变量 <b>STAR_PM_MCP_SECRET</b> 以确认是你本人。</p>
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeAttr(p.client_id)}" />
      <input type="hidden" name="redirect_uri" value="${escapeAttr(p.redirect_uri)}" />
      <input type="hidden" name="response_type" value="code" />
      <input type="hidden" name="state" value="${escapeAttr(p.state)}" />
      <input type="hidden" name="scope" value="${escapeAttr(p.scope)}" />
      <input type="hidden" name="code_challenge" value="${escapeAttr(p.code_challenge)}" />
      <input type="hidden" name="code_challenge_method" value="S256" />
      <label>STAR_PM_MCP_SECRET</label>
      <input type="password" name="secret" required autocomplete="current-password" />
      <button type="submit">批准授权</button>
    </form>
    <p style="margin-top:14px;font-size:12px">查询串备用：${escapeHtml(qs.slice(0, 80))}…</p>
  `);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const p = readParams(form);

  if (!assertOwnerSecret(p.secret)) {
    return htmlPage(
      `<h1>密钥错误</h1><p>请使用 Vercel 上的 STAR_PM_MCP_SECRET。</p><p><a href="/oauth/authorize?${new URLSearchParams(
        {
          client_id: p.client_id,
          redirect_uri: p.redirect_uri,
          response_type: "code",
          state: p.state,
          scope: p.scope,
          code_challenge: p.code_challenge,
          code_challenge_method: "S256",
        }
      ).toString()}">返回重试</a></p>`,
      401
    );
  }

  const client = await getClient(p.client_id);
  if (!client || !clientAcceptsRedirect(client, p.redirect_uri)) {
    return htmlPage("<h1>client / redirect_uri 无效</h1>", 400);
  }
  if (!p.code_challenge || p.code_challenge_method !== "S256") {
    return htmlPage("<h1>缺少 PKCE S256</h1>", 400);
  }

  const code = randomToken(24);
  await saveAuthCode({
    code,
    client_id: p.client_id,
    redirect_uri: p.redirect_uri,
    code_challenge: p.code_challenge,
    code_challenge_method: "S256",
    scope: p.scope || "star-pm:read star-pm:write",
    expires_at: Date.now() + 5 * 60 * 1000,
  });

  const redirect = new URL(p.redirect_uri);
  redirect.searchParams.set("code", code);
  if (p.state) redirect.searchParams.set("state", p.state);
  return NextResponse.redirect(redirect.toString(), 302);
}

function escapeAttr(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
