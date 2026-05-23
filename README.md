# @gitghost/mcp

> AI agents can sign commits anonymously with gitghost.

`@gitghost/mcp` is a local stdio MCP server for gitghost. It lets MCP-compatible agents initialize gitghost, manage a contributor ring, create ring-signed commits, and verify ghost commits without exposing `.gitghost/identity.json`.

## Install

```bash
npm install -g @gitghost/mcp
```

Or use it without installing:

```bash
npx @gitghost/mcp
```

## Claude Desktop config

Run the MCP server from inside the git repository you want gitghost to operate on. If your MCP client supports a `cwd` setting, point it at the repo root. Otherwise launch the client/session from the repo root before calling gitghost tools.

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

## Tools

- `gitghost_init` — initialize `.gitghost/` in the current repo.
- `gitghost_ring_add_self` — add the local gitghost public key to the ring.
- `gitghost_ring_add` — add a GitHub user's derived ghost public key.
- `gitghost_ring_list` — list the current ring and ring root.
- `gitghost_commit` — create a ring-signed commit as `ghost <ghost@gitghost.org>`.
- `gitghost_verify` — verify a ghost commit's LSAG trailers.

## Resources

- `gitghost://ring` — read the current ring config and computed ring root.
- `gitghost://anchors` — read local anchor records.

The server does not provide a resource for `identity.json`.

## Security model

The MCP server runs locally as a separate stdio process. Tools may use your local key to sign commits, but they never return the secret key or raw `.gitghost/identity.json` content to the model. Treat `.gitghost/identity.json` like an SSH private key.

stdout is reserved for MCP protocol messages. Human-readable status is returned through MCP tool responses, not printed directly by the server.

## Identity model caveat

A one-person ring is not anonymous. gitghost is meaningful when the signer is hidden inside a real contributor ring. The commit proves one member of the ring signed, not which member.

## Relationship to @gitghost/cli

The CLI is the human terminal interface. This MCP server is the agent interface. Both use the same gitghost signing and verification model.

## Local dogfood flow

If you want to test the exact npm package artifact before publishing it:

1. Build and pack it:

```bash
npm run build
npm pack --json
```

This creates `gitghost-mcp-0.1.0.tgz`, the same package shape npm will publish.

2. Install the tarball into an isolated npm prefix:

```powershell
$prefix = "C:\Users\aXL\AppData\Local\Temp\opencode\gitghost-mcp-prefix"
if (Test-Path -LiteralPath $prefix) { Remove-Item -LiteralPath $prefix -Recurse -Force }
New-Item -ItemType Directory -Path $prefix | Out-Null
npm install --prefix $prefix "C:\path\to\ghost-agent\gitghost-mcp-0.1.0.tgz"
```

3. Create a temp git repo:

```powershell
$root = "C:\Users\aXL\AppData\Local\Temp\opencode\gitghost-mcp-dogfood"
if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
New-Item -ItemType Directory -Path $root | Out-Null
git init $root
git -C $root config user.name "Real User"
git -C $root config user.email "real@example.com"
Set-Location -LiteralPath $root
```

4. Call the installed package binary with the official Inspector CLI:

```powershell
$cmd = "C:\Users\aXL\AppData\Local\Temp\opencode\gitghost-mcp-prefix\node_modules\.bin\gitghost-mcp.cmd"
npx -y @modelcontextprotocol/inspector --cli $cmd --method tools/list
npx -y @modelcontextprotocol/inspector --cli $cmd --method tools/call --tool-name gitghost_init --tool-arg ringName=dogfood
npx -y @modelcontextprotocol/inspector --cli $cmd --method tools/call --tool-name gitghost_ring_add_self
npx -y @modelcontextprotocol/inspector --cli $cmd --method tools/call --tool-name gitghost_ring_add --tool-arg github=torvalds
npx -y @modelcontextprotocol/inspector --cli $cmd --method tools/call --tool-name gitghost_commit --tool-arg message="feat: dogfood"
npx -y @modelcontextprotocol/inspector --cli $cmd --method tools/call --tool-name gitghost_verify --tool-arg sha=<commit-sha>
```

Run these Inspector commands from inside `$root`. The MCP server uses the current working directory to find the target git repository.

5. Confirm the commit author/committer is `ghost <ghost@gitghost.org>` and the verify result is `valid: true`.
