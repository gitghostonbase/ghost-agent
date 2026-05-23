# For Agents

`@gitghost/mcp` is an MCP server for AI agents that need to create and verify anonymous git commits.

It runs locally over stdio, so the agent works inside the user's machine and repository context. This makes it suitable for MCP-compatible agents such as Claude Desktop, Cursor, Cline, OpenCode, and other clients that can launch local MCP servers.

## Claude Desktop / MCP client config

Point the client at the git repository the agent should operate on:

```json
{
  "mcpServers": {
    "gitghost": {
      "command": "npx",
      "args": ["@gitghost/mcp"],
      "cwd": "/path/to/your/repo"
    }
  }
}
```

## What agents can do

Once connected, the agent gets access to these tools:

- `gitghost_init`
- `gitghost_ring_add_self`
- `gitghost_ring_add`
- `gitghost_ring_list`
- `gitghost_commit`
- `gitghost_verify`

## npx usage

Agents or local clients can start the server without a global install:

```bash
npx @gitghost/mcp
```

## Global install

If the client prefers a fixed binary:

```bash
npm install -g @gitghost/mcp
```

Then point the client at:

```json
{
  "mcpServers": {
    "gitghost": {
      "command": "gitghost-mcp",
      "cwd": "/path/to/your/repo"
    }
  }
}
```

## Notes for agents

- The server must run inside or against the target git repository.
- Commit signing stays local to the user's machine.
- The server never exposes `.gitghost/identity.json`.
- Anonymous signing requires a ring with more than one member.
