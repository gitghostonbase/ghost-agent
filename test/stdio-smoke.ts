import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

type ToolEnvelope<T> = {
  ok: boolean;
  action: string;
  data?: T;
  error?: string;
};

type RingMember = {
  github: string;
  publicKey: string;
  source: "github" | "local" | "manual";
  fetchedAt: number;
};

type RingFile = {
  version: 1;
  name: string;
  context: string;
  members: RingMember[];
  createdAt: number;
};

const serverPath = resolve("dist", "src", "index.js");
if (!existsSync(serverPath)) {
  throw new Error(`built server not found at ${serverPath}; run npm run build --prefix mcp first`);
}

const repoRoot = mkdtempSync(join(tmpdir(), "gitghost-mcp-stdio-"));

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

function requireToolData<T>(result: unknown): T {
  if (typeof result !== "object" || result === null || !("structuredContent" in result)) {
    throw new Error(`tool response missing structuredContent: ${JSON.stringify(result)}`);
  }
  const structuredContent = (result as { structuredContent?: unknown }).structuredContent;
  const envelope = structuredContent as ToolEnvelope<T> | undefined;
  if (!envelope?.ok || !envelope.data) {
    throw new Error(`tool failed: ${JSON.stringify(result.structuredContent)}`);
  }
  return envelope.data;
}

async function main(): Promise<void> {
  execFileSync("git", ["init"], { cwd: repoRoot });
  execFileSync("git", ["config", "user.name", "Real User"], { cwd: repoRoot });
  execFileSync("git", ["config", "user.email", "real@example.com"], { cwd: repoRoot });

  const client = new Client({ name: "gitghost-stdio-smoke", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: repoRoot,
    stderr: "pipe",
  });
  const stderrChunks: string[] = [];
  transport.stderr?.on("data", (chunk) => {
    stderrChunks.push(Buffer.from(chunk).toString("utf8"));
  });

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name).sort();
    const expectedTools = [
      "gitghost_commit",
      "gitghost_init",
      "gitghost_ring_add",
      "gitghost_ring_add_self",
      "gitghost_ring_list",
      "gitghost_verify",
    ];
    if (JSON.stringify(toolNames) !== JSON.stringify(expectedTools)) {
      throw new Error(`unexpected tools: ${JSON.stringify(toolNames)}`);
    }

    requireToolData(await client.callTool({ name: "gitghost_init", arguments: { ringName: "stdio-smoke" } }));
    requireToolData(await client.callTool({ name: "gitghost_ring_add_self", arguments: {} }));

    const ringPath = join(repoRoot, ".gitghost", "ring.json");
    const ring = JSON.parse(readFileSync(ringPath, "utf8")) as RingFile;
    ring.members.push({
      github: "fixture",
      publicKey: "02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
      source: "manual",
      fetchedAt: Date.now(),
    });
    writeFileSync(ringPath, JSON.stringify(ring, null, 2));

    const commit = requireToolData<{ commit: string }>(
      await client.callTool({ name: "gitghost_commit", arguments: { message: "feat: stdio smoke" } }),
    );
    const verify = requireToolData<{ valid: boolean; commit: string }>(
      await client.callTool({ name: "gitghost_verify", arguments: { sha: commit.commit } }),
    );
    if (!verify.valid || verify.commit !== commit.commit) {
      throw new Error(`verify failed: ${JSON.stringify(verify)}`);
    }

    const author = git(["log", "-1", "--format=%an <%ae>|%cn <%ce>", commit.commit]).trim();
    if (author !== "ghost <ghost@gitghost.org>|ghost <ghost@gitghost.org>") {
      throw new Error(`identity hygiene failed: ${author}`);
    }

    const resources = await client.listResources();
    const resourceUris = resources.resources.map((resource) => resource.uri).sort();
    if (JSON.stringify(resourceUris) !== JSON.stringify(["gitghost://anchors", "gitghost://ring"])) {
      throw new Error(`unexpected resources: ${JSON.stringify(resourceUris)}`);
    }

    const prompts = await client.listPrompts();
    const promptNames = prompts.prompts.map((prompt) => prompt.name).sort();
    if (JSON.stringify(promptNames) !== JSON.stringify(["sign_this_pr_anonymously", "verify_ghost_commits"])) {
      throw new Error(`unexpected prompts: ${JSON.stringify(promptNames)}`);
    }

    if (stderrChunks.join("").trim().length > 0) {
      throw new Error(`unexpected server stderr: ${stderrChunks.join("")}`);
    }

    console.log(`stdio smoke ok: ${commit.commit}`);
  } finally {
    await client.close().catch(() => undefined);
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

void main();
