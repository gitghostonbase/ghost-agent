import { describe, expect, test } from "vitest";
import { commitSchema, initSchema, ringAddSchema, verifySchema } from "../src/schemas.js";

describe("tool schemas", () => {
  test("init requires a non-empty ring name", () => {
    expect(initSchema.parse({ ringName: "frontend-frameworks" })).toEqual({ ringName: "frontend-frameworks" });
    expect(() => initSchema.parse({ ringName: "" })).toThrow();
  });

  test("ring add normalizes github input shape", () => {
    expect(ringAddSchema.parse({ github: "torvalds" })).toEqual({ github: "torvalds" });
    expect(ringAddSchema.parse({ github: "@gregkh" })).toEqual({ github: "@gregkh" });
    expect(() => ringAddSchema.parse({ github: "" })).toThrow();
  });

  test("commit requires message", () => {
    expect(commitSchema.parse({ message: "feat: ghost" })).toEqual({ message: "feat: ghost" });
    expect(() => commitSchema.parse({ message: "   " })).toThrow();
  });

  test("verify requires a commit sha string", () => {
    expect(verifySchema.parse({ sha: "HEAD" })).toEqual({ sha: "HEAD" });
    expect(() => verifySchema.parse({ sha: "" })).toThrow();
  });
});
