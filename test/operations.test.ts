import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { addSelfToRing, commitGhost, initGitghost, listRing, verifyGhostCommit } from "../src/operations.js";

let previousCwd: string;
let repoRoot: string;

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

beforeEach(() => {
  previousCwd = process.cwd();
  repoRoot = mkdtempSync(join(tmpdir(), "gitghost-mcp-"));
  execFileSync("git", ["init"], { cwd: repoRoot });
  execFileSync("git", ["config", "user.name", "Real User"], { cwd: repoRoot });
  execFileSync("git", ["config", "user.email", "real@example.com"], { cwd: repoRoot });
  process.chdir(repoRoot);
});

afterEach(() => {
  process.chdir(previousCwd);
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("gitghost MCP operations", () => {
  test("init creates a CLI-compatible ring context and does not return secret", async () => {
    const result = await initGitghost({ ringName: "demo-ring" });
    const ring = JSON.parse(readFileSync(join(repoRoot, ".gitghost", "ring.json"), "utf8")) as { context: string };
    const expectedContext = bytesToHex(sha256(new TextEncoder().encode("gitghost.v1.context|demo-ring")));

    expect(ring.context).toBe(expectedContext);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  test("add self and ring list return redacted public member summary", async () => {
    await initGitghost({ ringName: "demo-ring" });
    await addSelfToRing();
    const ring = await listRing();

    expect(ring.members).toBe(1);
    expect(ring.entries[0]?.github).toBe("self");
    expect(ring.entries[0]?.publicKey).toContain("…");
  });

  test("commit rejects rings with fewer than two members", async () => {
    await initGitghost({ ringName: "demo-ring" });
    await addSelfToRing();

    await expect(commitGhost({ message: "feat: ghost" })).rejects.toThrow("ring needs at least 2 members for anonymity");
  });

  test("commit uses neutral author and committer identity when ring is valid", async () => {
    await initGitghost({ ringName: "demo-ring" });
    await addSelfToRing();
    const ringPath = join(repoRoot, ".gitghost", "ring.json");
    const ring = JSON.parse(readFileSync(ringPath, "utf8")) as { members: Array<Record<string, unknown>> };
    ring.members.push({ github: "fixture", publicKey: "02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9", source: "manual", fetchedAt: Date.now() });
    writeFileSync(ringPath, JSON.stringify(ring, null, 2));

    const commit = await commitGhost({ message: "feat: ghost" });
    const author = git(["log", "-1", "--format=%an <%ae>|%cn <%ce>", commit.commit]).trim();

    expect(author).toBe("ghost <ghost@gitghost.org>|ghost <ghost@gitghost.org>");
  });

  test("verify succeeds for a valid ghost commit", async () => {
    await initGitghost({ ringName: "demo-ring" });
    await addSelfToRing();
    const ringPath = join(repoRoot, ".gitghost", "ring.json");
    const ring = JSON.parse(readFileSync(ringPath, "utf8")) as { members: Array<Record<string, unknown>> };
    ring.members.push({ github: "fixture", publicKey: "02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9", source: "manual", fetchedAt: Date.now() });
    writeFileSync(ringPath, JSON.stringify(ring, null, 2));

    const commit = await commitGhost({ message: "feat: ghost" });
    const result = await verifyGhostCommit({ sha: commit.commit });

    expect(result.valid).toBe(true);
    expect(result.commit).toBe(commit.commit);
    expect(result.signerSetSize).toBe(2);
    expect(result.keyImageReuses).toEqual([]);
  });

  test("verify rejects non-ghost commits cleanly", async () => {
    git(["commit", "--allow-empty", "-m", "chore: regular"]);

    await expect(verifyGhostCommit({ sha: "HEAD" })).rejects.toThrow("not a ghost commit");
  });
});
