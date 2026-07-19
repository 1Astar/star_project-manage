import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { enableMcpMigrationWrite } from "@/lib/mcp/migration-write";
import { registerStarPmTools } from "@/lib/mcp/server";

async function main() {
  enableMcpMigrationWrite();
  const server = new McpServer({
    name: "star-pm",
    version: "1.7.6",
  });
  registerStarPmTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
