/**
 * MCP 协议 serverInfo.version —— 与页面 / package.json 无关。
 * 仅在 MCP 工具、鉴权、传输层有实质变更时升号。
 */
export const MCP_SERVER_NAME = "star-pm";
export const MCP_OAUTH_SERVER_NAME = "star-pm-gpt";

/** 当前 MCP 能力版本（Bearer / OAuth / stdio 共用） */
export const MCP_SERVER_VERSION = "1.4.0";
