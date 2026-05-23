import { describe, expect, test } from "vitest";
import { withoutProtocolStdout } from "../src/stdio.js";

describe("stdio hygiene", () => {
  test("captures accidental stdout writes while preserving return value", async () => {
    const result = await withoutProtocolStdout(async () => {
      console.log("this would corrupt MCP stdout");
      return "ok";
    });

    expect(result.value).toBe("ok");
    expect(result.capturedStdout).toEqual(["this would corrupt MCP stdout\n"]);
  });
});
