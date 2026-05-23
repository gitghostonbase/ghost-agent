import { describe, expect, test } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js";
import { createGitghostMcpServer } from "../src/server.js";

class InMemoryTransport implements Transport {
  peer?: InMemoryTransport;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(message: T) => void;

  async start(): Promise<void> {
    return Promise.resolve();
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    queueMicrotask(() => {
      this.peer?.onmessage?.(message);
    });
  }

  async close(): Promise<void> {
    this.onclose?.();
  }
}

function createTransportPair(): [InMemoryTransport, InMemoryTransport] {
  const clientTransport = new InMemoryTransport();
  const serverTransport = new InMemoryTransport();
  clientTransport.peer = serverTransport;
  serverTransport.peer = clientTransport;
  return [clientTransport, serverTransport];
}

describe("createGitghostMcpServer", () => {
  test("constructs an MCP server", () => {
    const server = createGitghostMcpServer();
    expect(server).toBeDefined();
    expect(typeof server.connect).toBe("function");
  });

  test("registers all v1 tools, resources, and prompts over MCP", async () => {
    const server = createGitghostMcpServer();
    const client = new Client({ name: "gitghost-mcp-test", version: "0.1.0" });
    const [clientTransport, serverTransport] = createTransportPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const [tools, resources, prompts] = await Promise.all([
      client.listTools(),
      client.listResources(),
      client.listPrompts(),
    ]);

    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "gitghost_commit",
      "gitghost_init",
      "gitghost_ring_add",
      "gitghost_ring_add_self",
      "gitghost_ring_list",
      "gitghost_verify",
    ]);
    expect(resources.resources.map((resource) => resource.uri).sort()).toEqual([
      "gitghost://anchors",
      "gitghost://ring",
    ]);
    expect(prompts.prompts.map((prompt) => prompt.name).sort()).toEqual([
      "sign_this_pr_anonymously",
      "verify_ghost_commits",
    ]);

    await Promise.all([client.close(), server.close()]);
  });
});
