import { NextResponse } from "next/server";
import {
  getClient,
  randomToken,
  saveAccessToken,
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

export async function POST(request: Request) {
  const body = await readBody(request);
  const { client_id, client_secret } = clientAuth(request, body);

  if (body.grant_type !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  }

  const client = await getClient(client_id);
  if (!client) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }
  if (client.token_endpoint_auth_method !== "none") {
    if (!client_secret || client_secret !== client.client_secret) {
      return NextResponse.json({ error: "invalid_client" }, { status: 401 });
    }
  }

  const code = body.code;
  const redirectUri = body.redirect_uri;
  const verifier = body.code_verifier;
  if (!code || !redirectUri || !verifier) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const authCode = await takeAuthCode(code);
  if (!authCode || authCode.expires_at < Date.now()) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }
  if (authCode.client_id !== client_id || authCode.redirect_uri !== redirectUri) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }
  if (!verifyPkce(verifier, authCode.code_challenge, authCode.code_challenge_method)) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      { status: 400 }
    );
  }

  const accessToken = randomToken(32);
  const expiresIn = 60 * 60 * 12;
  await saveAccessToken({
    token: accessToken,
    client_id,
    scope: authCode.scope,
    expires_at: Date.now() + expiresIn * 1000,
  });

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: expiresIn,
      scope: authCode.scope,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
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
