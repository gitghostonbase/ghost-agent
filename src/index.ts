#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGitghostMcpServer } from "./server.js";

async function main(): Promise<void> {
  const server = createGitghostMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[gitghost-mcp] fatal: ${message}`);
  process.exit(1);
});
