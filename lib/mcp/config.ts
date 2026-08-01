/**
 * TCP Redis URL for MCP SSE transport (`redis://` / `rediss://`, not Upstash REST).
 *
 * Cloudflare Workers have no TCP Redis — omit `REDIS_URL` / `KV_URL` / `UPSTASH_REDIS_URL`
 * on CF. MCP HTTP routes set `disableSse: true` when this returns undefined (Streamable HTTP only).
 * Upstash REST (`KV_REST_API_*`) is still used for OAuth token storage.
 */
export function getMcpRedisUrl(): string | undefined {
  const url =
    process.env.REDIS_URL?.trim() ||
    process.env.KV_URL?.trim() ||
    process.env.UPSTASH_REDIS_URL?.trim();
  return url || undefined;
}
