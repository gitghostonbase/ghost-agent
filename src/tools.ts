import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  addGithubUserToRing,
  addSelfToRing,
  commitGhost,
  initGitghost,
  listRing,
  verifyGhostCommit,
} from "./operations.js";
import { commitSchema, emptySchema, initSchema, ringAddSchema, verifySchema } from "./schemas.js";
import { toolFailure, toolSuccess } from "./responses.js";
import { sanitizeErrorMessage } from "./security.js";

async function safeTool<T>(action: string, run: () => Promise<T>): Promise<CallToolResult> {
  try {
    return toolSuccess(action, await run());
  } catch (error) {
    return toolFailure(action, sanitizeErrorMessage(error));
  }
}

export function registerGitghostTools(server: McpServer): void {
  server.registerTool(
    "gitghost_init",
    {
      title: "Initialize gitghost",
      description: "Initialize .gitghost in the current git repository without exposing identity secrets.",
      inputSchema: initSchema,
    },
    async (input) => safeTool("gitghost_init", () => initGitghost(input)),
  );

  server.registerTool(
    "gitghost_ring_add_self",
    {
      title: "Add local identity to ring",
      description: "Add the local gitghost public key to the current ring. Secret key material is never returned.",
      inputSchema: emptySchema,
    },
    async () => safeTool("gitghost_ring_add_self", () => addSelfToRing()),
  );

  server.registerTool(
    "gitghost_ring_add",
    {
      title: "Add GitHub user to ring",
      description: "Fetch github.com/<user>.keys and add a derived ghost public key to the current ring.",
      inputSchema: ringAddSchema,
    },
    async (input) => safeTool("gitghost_ring_add", () => addGithubUserToRing(input)),
  );

  server.registerTool(
    "gitghost_ring_list",
    {
      title: "List current ring",
      description: "List the current ring root and redacted member public keys.",
      inputSchema: emptySchema,
    },
    async () => safeTool("gitghost_ring_list", () => listRing()),
  );

  server.registerTool(
    "gitghost_commit",
    {
      title: "Create anonymous signed commit",
      description: "Create a git commit signed by one member of the current gitghost ring.",
      inputSchema: commitSchema,
    },
    async (input) => safeTool("gitghost_commit", () => commitGhost(input)),
  );

  server.registerTool(
    "gitghost_verify",
    {
      title: "Verify ghost commit",
      description: "Verify LSAG ghost trailers on a commit using the local ring config.",
      inputSchema: verifySchema,
    },
    async (input) => safeTool("gitghost_verify", () => verifyGhostCommit(input)),
  );
}
