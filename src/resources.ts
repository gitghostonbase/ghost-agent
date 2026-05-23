import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readAnchorsResource, readRingResource } from "./operations.js";
import { formatJsonText } from "./responses.js";
import { assertSafeGitghostResource, redactSecretFields, sanitizeErrorMessage } from "./security.js";

export function registerGitghostResources(server: McpServer): void {
  server.registerResource(
    "gitghost-ring",
    "gitghost://ring",
    {
      title: "gitghost ring",
      description: "Current gitghost ring config with computed ring root. Secret identity material is not included.",
      mimeType: "application/json",
    },
    async (uri) => {
      assertSafeGitghostResource(uri.href);
      try {
        const ring = redactSecretFields(await readRingResource());
        return { contents: [{ uri: uri.href, mimeType: "application/json", text: formatJsonText(ring) }] };
      } catch (error) {
        return { contents: [{ uri: uri.href, mimeType: "application/json", text: formatJsonText({ ok: false, error: sanitizeErrorMessage(error) }) }] };
      }
    },
  );

  server.registerResource(
    "gitghost-anchors",
    "gitghost://anchors",
    {
      title: "gitghost anchors",
      description: "Local gitghost anchor log. Secret identity material is not included.",
      mimeType: "application/json",
    },
    async (uri) => {
      assertSafeGitghostResource(uri.href);
      try {
        const anchors = redactSecretFields(await readAnchorsResource());
        return { contents: [{ uri: uri.href, mimeType: "application/json", text: formatJsonText(anchors) }] };
      } catch (error) {
        return { contents: [{ uri: uri.href, mimeType: "application/json", text: formatJsonText({ ok: false, error: sanitizeErrorMessage(error) }) }] };
      }
    },
  );
}
