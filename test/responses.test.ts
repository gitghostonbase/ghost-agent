import { describe, expect, test } from "vitest";
import { formatJsonText, toolFailure, toolSuccess } from "../src/responses.js";

describe("response helpers", () => {
  test("formats JSON as readable text", () => {
    expect(formatJsonText({ ok: true, ring: "demo" })).toBe('{\n  "ok": true,\n  "ring": "demo"\n}');
  });

  test("builds successful MCP tool response with structured content", () => {
    const result = toolSuccess("gitghost_ring_list", { ringName: "demo", members: 2 });

    expect(result.structuredContent).toEqual({
      ok: true,
      action: "gitghost_ring_list",
      data: { ringName: "demo", members: 2 }
    });
    expect(result.content[0]).toEqual({
      type: "text",
      text: '{\n  "ok": true,\n  "action": "gitghost_ring_list",\n  "data": {\n    "ringName": "demo",\n    "members": 2\n  }\n}'
    });
  });

  test("builds failure MCP tool response without throwing", () => {
    const result = toolFailure("gitghost_commit", "ring needs at least 2 members for anonymity");

    expect(result.structuredContent).toEqual({
      ok: false,
      action: "gitghost_commit",
      error: "ring needs at least 2 members for anonymity"
    });
    expect(result.isError).toBe(true);
  });
});
