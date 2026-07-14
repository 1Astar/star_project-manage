import { NextResponse } from "next/server";
import {
  isAllowedRedirect,
  randomToken,
  saveClient,
  type OAuthClient,
} from "@/lib/mcp/oauth/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const redirectUris = Array.isArray(body.redirect_uris)
    ? (body.redirect_uris as string[])
    : [];
  if (!redirectUris.length || !redirectUris.every(isAllowedRedirect)) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris 无效或不允许" },
      { status: 400 }
    );
  }

  const authMethod =
    typeof body.token_endpoint_auth_method === "string"
      ? body.token_endpoint_auth_method
      : "none";

  const client: OAuthClient = {
    client_id: `gpt_${randomToken(12)}`,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: authMethod,
    client_name: typeof body.client_name === "string" ? body.client_name : "ChatGPT",
    grant_types: Array.isArray(body.grant_types)
      ? (body.grant_types as string[])
      : ["authorization_code"],
    response_types: Array.isArray(body.response_types)
      ? (body.response_types as string[])
      : ["code"],
    scope: typeof body.scope === "string" ? body.scope : "star-pm:read star-pm:write",
  };

  if (authMethod !== "none") {
    client.client_secret = randomToken(24);
  }

  await saveClient(client);

  return NextResponse.json(
    {
      client_id: client.client_id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret: client.client_secret,
      client_secret_expires_at: 0,
      redirect_uris: client.redirect_uris,
      grant_types: client.grant_types,
      response_types: client.response_types,
      token_endpoint_auth_method: client.token_endpoint_auth_method,
      client_name: client.client_name,
      scope: client.scope,
    },
    {
      status: 201,
      headers: { "Access-Control-Allow-Origin": "*" },
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
