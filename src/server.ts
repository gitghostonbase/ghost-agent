import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGitghostPrompts } from "./prompts.js";
import { registerGitghostResources } from "./resources.js";
import { registerGitghostTools } from "./tools.js";

export function createGitghostMcpServer(): McpServer {
  const server = new McpServer({
    name: "gitghost",
    version: "0.1.0",
  });
  registerGitghostTools(server);
  registerGitghostResources(server);
  registerGitghostPrompts(server);
  return server;
}
