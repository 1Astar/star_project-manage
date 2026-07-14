import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerStarPmTools } from "@/lib/mcp/server";

async function main() {
  const server = new McpServer({
    name: "star-pm",
    version: "1.3.2",
  });
  registerStarPmTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
