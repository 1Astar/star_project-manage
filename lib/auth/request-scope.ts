import { AsyncLocalStorage } from "node:async_hooks";
import type { AuthSession } from "@/lib/auth/session";

type RequestAuthScope = {
  /** MCP Bearer / OAuth 已通过 → 等价管理员，不进演示沙盘 */
  mcpAdmin: boolean;
};

const storage = new AsyncLocalStorage<RequestAuthScope>();

export function runWithMcpAdminScope<T>(fn: () => T): T {
  return storage.run({ mcpAdmin: true }, fn);
}

export function isMcpAdminScope(): boolean {
  return storage.getStore()?.mcpAdmin === true;
}

/** MCP 请求内视为管理员会话 */
export function getMcpAdminSession(): AuthSession | null {
  if (!isMcpAdminScope()) return null;
  return { email: "mcp-admin", role: "admin" };
}
