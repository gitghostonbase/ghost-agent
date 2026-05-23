import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerGitghostPrompts(server: McpServer): void {
  server.registerPrompt(
    "sign_this_pr_anonymously",
    {
      title: "Sign this PR anonymously",
      description: "Guide an agent to create a gitghost ring-signed commit for the current staged changes.",
    },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Inspect the current staged git changes. If gitghost is initialized and the ring has at least two members, call gitghost_commit with a concise commit message. Never ask to read identity.json.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "verify_ghost_commits",
    {
      title: "Verify ghost commits",
      description: "Guide an agent to verify one or more gitghost signed commits in the current repository.",
    },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Identify the commit SHA or SHAs the user wants verified, then call gitghost_verify for each SHA. Summarize valid signatures, invalid signatures, and key-image reuse warnings.",
          },
        },
      ],
    }),
  );
}
