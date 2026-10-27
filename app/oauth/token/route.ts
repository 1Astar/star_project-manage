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

function clientAuth(
  request: Request,
  body: Record<string, string>
): { client_id: string; client_secret?: string } {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    return {
      client_id: decodeURIComponent(decoded.slice(0, idx)),
      client_secret: decodeURIComponent(decoded.slice(idx + 1)),
    };
  }
  return {
    client_id: body.client_id || "",
    client_secret: body.client_secret,
  };
}

const cors = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
};

export async function POST(request: Request) {
  const body = await readBody(request);
  const { client_id, client_secret } = clientAuth(request, body);

  // DCR client 在无 Redis 时可能丢；gpt_/cursor_ 用 redirect 自动恢复
  const client =
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
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401, headers: cors });
  }
  if (client.token_endpoint_auth_method !== "none") {
    if (!client_secret || client_secret !== client.client_secret) {
      return NextResponse.json({ error: "invalid_client" }, { status: 401, headers: cors });
    }
  }

  if (body.grant_type === "refresh_token") {
    const refresh = body.refresh_token;
    if (!refresh) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: cors });
    }
    const pair = await refreshAccessToken(refresh, client_id);
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

  const authCode = await takeAuthCode(code);
  if (!authCode || authCode.expires_at < Date.now()) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400, headers: cors });
  }
  if (authCode.client_id !== client_id || authCode.redirect_uri !== redirectUri) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400, headers: cors });
  }
  if (!verifyPkce(verifier, authCode.code_challenge, authCode.code_challenge_method)) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      { status: 400, headers: cors }
    );
  }

  const pair = await issueTokenPair({
    client_id,
    scope: authCode.scope,
  });

  return NextResponse.json(pair, { headers: cors });
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
