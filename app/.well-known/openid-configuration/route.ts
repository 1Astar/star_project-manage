import { NextResponse } from "next/server";
import { mcpOAuthResourceUrl, publicOrigin } from "@/lib/mcp/oauth/store";

export const runtime = "nodejs";

/** OIDC 发现别名；ChatGPT 文档允许 AS 用 openid-configuration 或 oauth-authorization-server */
function metadata(request: Request) {
  const origin = publicOrigin(request);
  const resource = mcpOAuthResourceUrl(origin);
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: ["star-pm:read", "star-pm:write", "offline_access", "openid"],
    authorization_response_iss_parameter_supported: true,
    client_id_metadata_document_supported: true,
    resource,
    resource_metadata: `${origin}/.well-known/oauth-protected-resource/api/mcp-oauth/mcp`,
    service_documentation: `${origin}`,
  };
}

export async function GET(request: Request) {
  return NextResponse.json(metadata(request), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
