/** ChatGPT CIMD；不依赖 store，避免循环引用。 */

export type CimdClient = {
  client_id: string;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  client_name: string;
  grant_types: string[];
  response_types: string[];
  scope: string;
};

function isAllowedCimdHost(hostname: string) {
  return (
    hostname === "chatgpt.com" ||
    hostname.endsWith(".chatgpt.com") ||
    hostname === "chat.openai.com" ||
    hostname.endsWith(".openai.com")
  );
}

function isHttpsRedirect(uri: string) {
  try {
    const u = new URL(uri);
    return u.protocol === "https:" && isAllowedCimdHost(u.hostname);
  } catch {
    return false;
  }
}

/** ChatGPT 稳定 CIMD；Workers 出站拉 chatgpt.com 失败时仍能授权。 */
function knownChatGptClient(clientId: string): CimdClient | null {
  if (clientId !== "https://chatgpt.com/oauth/client.json") return null;
  return {
    client_id: clientId,
    redirect_uris: [
      "https://chatgpt.com/connector_platform_oauth_redirect",
      "https://chatgpt.com/connector/oauth/callback",
    ],
    token_endpoint_auth_method: "none",
    client_name: "ChatGPT",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "star-pm:read star-pm:write offline_access",
  };
}

/**
 * Client ID Metadata Document：client_id 为 https URL。
 * 稳定文档：https://chatgpt.com/oauth/client.json
 */
export async function fetchCimdClient(clientId: string): Promise<CimdClient | null> {
  if (!clientId.startsWith("https://")) return null;
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !isAllowedCimdHost(url.hostname)) return null;
  if (!url.pathname || url.pathname === "/") return null;

  const known = knownChatGptClient(clientId);
  // 固定 ChatGPT 文档不必出站 fetch（Workers 拉 chatgpt.com 常抛错）
  if (known) return known;

  let res: Response;
  try {
    res = await fetch(clientId, {
      headers: { Accept: "application/json" },
      redirect: "follow",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let doc: Record<string, unknown>;
  try {
    doc = (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (doc.client_id !== clientId) return knownChatGptClient(clientId);

  const rawUris = Array.isArray(doc.redirect_uris) ? doc.redirect_uris : [];
  const redirect_uris = rawUris.filter(
    (u): u is string => typeof u === "string" && isHttpsRedirect(u)
  );
  if (!redirect_uris.length) return null;

  // ChatGPT CIMD 同时声明 none + private_key_jwt；我们接受 none（免 JWKS），
  // 若对方带 client_assertion 则 token 端可忽略并仍按 client_id 放行。
  const methods = Array.isArray(doc.token_endpoint_auth_methods_supported)
    ? (doc.token_endpoint_auth_methods_supported as unknown[]).filter(
        (m): m is string => typeof m === "string"
      )
    : [];
  const authMethod =
    methods.includes("none") || doc.token_endpoint_auth_method === "none"
      ? "none"
      : typeof doc.token_endpoint_auth_method === "string"
        ? doc.token_endpoint_auth_method
        : "none";

  return {
    client_id: clientId,
    redirect_uris,
    token_endpoint_auth_method: authMethod,
    client_name: typeof doc.client_name === "string" ? doc.client_name : "ChatGPT",
    grant_types: Array.isArray(doc.grant_types)
      ? (doc.grant_types as string[])
      : ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "star-pm:read star-pm:write offline_access",
  };
}
