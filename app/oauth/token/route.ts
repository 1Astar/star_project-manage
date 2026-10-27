import { NextResponse } from "next/server";
import {
  ensureDcrClient,
  getClient,
  issueTokenPair,
  refreshAccessToken,
  takeAuthCode,
  verifyPkce,
} from "@/lib/mcp/oauth/store";

export const runtime = "nodejs";

async function readBody(request: Request): Promise<Record<string, string>> {
  const ctype = request.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  const form = await request.formData();
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function clientIdFromJwt(assertion: string | undefined): string {
  if (!assertion) return "";
  const parts = assertion.split(".");
  if (parts.length < 2 || !parts[1]) return "";
  try {
    const pad = parts[1].length % 4 === 0 ? "" : "=".repeat(4 - (parts[1].length % 4));
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/") + pad);
    const payload = JSON.parse(json) as { sub?: unknown; iss?: unknown };
    if (typeof payload.sub === "string" && payload.sub.startsWith("https://")) return payload.sub;
    if (typeof payload.iss === "string" && payload.iss.startsWith("https://")) return payload.iss;
  } catch {
    return "";
  }
  return "";
}

function clientAuth(
  request: Request,
  body: Record<string, string>
): { client_id: string; client_secret?: string } {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("basic ")) {
    const decoded = atob(header.slice(6).trim());
    const idx = decoded.indexOf(":");
    return {
      client_id: decodeURIComponent(decoded.slice(0, idx)),
      client_secret: decodeURIComponent(decoded.slice(idx + 1)),
    };
  }
  return {
    client_id: body.client_id || clientIdFromJwt(body.client_assertion) || "",
    client_secret: body.client_secret,
  };
}

const cors = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
};

export async function POST(request: Request) {
  let body: Record<string, string>;
  try {
    body = await readBody(request);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "body";
    return NextResponse.json({ error: "invalid_request", error_description: msg }, { status: 400, headers: cors });
  }
  const { client_id, client_secret } = clientAuth(request, body);

  let client;
  try {
    client =
      (await getClient(client_id)) ??
      (body.redirect_uri ? await ensureDcrClient(client_id, body.redirect_uri) : null) ??
      (client_id.startsWith("gpt_") || client_id.startsWith("cursor_")
        ? await ensureDcrClient(client_id, "https://chatgpt.com/connector/oauth/callback")
        : null) ??
      (client_id.startsWith("https://")
        ? await ensureDcrClient(
            client_id,
            body.redirect_uri || "https://chatgpt.com/connector_platform_oauth_redirect"
          )
        : null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "client";
    return NextResponse.json({ error: "invalid_client", error_description: msg }, { status: 401, headers: cors });
  }
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401, headers: cors });
  }
  // CIMD ChatGPT 可能带 private_key_jwt assertion；本服务按公开客户端 + PKCE 放行
  if (client.token_endpoint_auth_method !== "none" && !body.client_assertion) {
    if (!client_secret || client_secret !== client.client_secret) {
      return NextResponse.json({ error: "invalid_client" }, { status: 401, headers: cors });
    }
  }

  if (body.grant_type === "refresh_token") {
    const refresh = body.refresh_token;
    if (!refresh) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: cors });
    }
    const pair = await refreshAccessToken(refresh, client.client_id);
    if (!pair) {
      return NextResponse.json({ error: "invalid_grant" }, { status: 400, headers: cors });
    }
    return NextResponse.json(pair, { headers: cors });
  }

  if (body.grant_type !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400, headers: cors });
  }

  const code = body.code;
  const redirectUri = body.redirect_uri;
  const verifier = body.code_verifier;
  if (!code || !redirectUri || !verifier) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: cors });
  }

  let authCode;
  try {
    authCode = await takeAuthCode(code);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "code";
    return NextResponse.json({ error: "invalid_grant", error_description: msg }, { status: 400, headers: cors });
  }
  if (!authCode || authCode.expires_at < Date.now()) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400, headers: cors });
  }
  if (authCode.client_id !== client.client_id || authCode.redirect_uri !== redirectUri) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400, headers: cors });
  }
  if (!verifyPkce(verifier, authCode.code_challenge, authCode.code_challenge_method)) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      { status: 400, headers: cors }
    );
  }

  try {
    const pair = await issueTokenPair({
      client_id: client.client_id,
      scope: authCode.scope,
    });
    return NextResponse.json(pair, { headers: cors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "token";
    return NextResponse.json({ error: "server_error", error_description: msg }, { status: 500, headers: cors });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
