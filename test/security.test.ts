import { describe, expect, test } from "vitest";
import { assertSafeGitghostResource, redactSecretFields, sanitizeErrorMessage } from "../src/security.js";

describe("security helpers", () => {
  test("allows only ring and anchors resources", () => {
    expect(() => assertSafeGitghostResource("gitghost://ring")).not.toThrow();
    expect(() => assertSafeGitghostResource("gitghost://anchors")).not.toThrow();
  });

  test("blocks identity resources", () => {
    expect(() => assertSafeGitghostResource("gitghost://identity")).toThrow("identity resource is forbidden");
    expect(() => assertSafeGitghostResource("gitghost://identity.json")).toThrow("identity resource is forbidden");
  });

  test("redacts secret-shaped fields recursively", () => {
    const redacted = redactSecretFields({
      publicKey: "pub",
      secret: "private",
      nested: { identity: { secret: "also-private", publicKey: "nested-pub" } }
    });

    expect(redacted).toEqual({
      publicKey: "pub",
      secret: "[REDACTED]",
      nested: { identity: "[REDACTED]" }
    });
  });

  test("sanitizes multiline stack-like errors", () => {
    expect(sanitizeErrorMessage(new Error("boom\n    at secret/path"))).toBe("boom");
  });
});
