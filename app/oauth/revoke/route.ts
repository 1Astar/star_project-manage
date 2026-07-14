import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Best-effort revoke; tokens expire naturally in Redis. */
export async function POST() {
  return NextResponse.json({ revoked: true }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
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
