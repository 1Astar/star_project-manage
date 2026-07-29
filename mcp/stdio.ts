import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { enableMcpMigrationWrite } from "@/lib/mcp/migration-write";
import { registerStarPmTools } from "@/lib/mcp/server";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "@/lib/mcp/version";

async function main() {
  enableMcpMigrationWrite();
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });
  registerStarPmTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
