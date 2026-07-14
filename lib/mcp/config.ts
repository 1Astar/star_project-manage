/** Redis URL for MCP SSE transport (redis:// or rediss://, not REST). */
export function getMcpRedisUrl(): string | undefined {
  const url =
    process.env.REDIS_URL?.trim() ||
    process.env.KV_URL?.trim() ||
    process.env.UPSTASH_REDIS_URL?.trim();
  return url || undefined;
}
