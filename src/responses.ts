import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type ToolEnvelope<T> = {
  ok: boolean;
  action: string;
  data?: T;
  error?: string;
};

export function formatJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function toolSuccess<T>(action: string, data: T): CallToolResult {
  const envelope: ToolEnvelope<T> = { ok: true, action, data };
  return {
    content: [{ type: "text", text: formatJsonText(envelope) }],
    structuredContent: envelope,
  };
}

export function toolFailure(action: string, error: string): CallToolResult {
  const envelope: ToolEnvelope<never> = { ok: false, action, error };
  return {
    isError: true,
    content: [{ type: "text", text: formatJsonText(envelope) }],
    structuredContent: envelope,
  };
}
