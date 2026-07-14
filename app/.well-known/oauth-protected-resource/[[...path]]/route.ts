import { NextResponse } from "next/server";
import { mcpOAuthResourceUrl, publicOrigin } from "@/lib/mcp/oauth/store";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ path?: string[] }> }
) {
  const origin = publicOrigin(request);
  const { path } = await context.params;
  const suffix = path?.length ? `/${path.join("/")}` : "";

  // ChatGPT probes path-aware URL first; advertise mcp-oauth resource either way.
  const resource =
    suffix.includes("mcp-oauth") || suffix.includes("/mcp")
      ? mcpOAuthResourceUrl(origin)
      : mcpOAuthResourceUrl(origin);

  return NextResponse.json(
    {
      resource,
      authorization_servers: [origin],
      scopes_supported: ["star-pm:read", "star-pm:write"],
      bearer_methods_supported: ["header"],
      resource_name: "Star PM MCP (GPT OAuth)",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
