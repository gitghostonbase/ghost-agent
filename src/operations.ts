import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { deriveGhostPublicKey, fetchGithubKeys } from "./core/github.js";
import {
  formatGhostTrailers,
  openRepo,
  parseGhostTrailers,
  stripGhostTrailers,
} from "./core/git.js";
import {
  parseSignature,
  serializeSignature,
  sign,
  verify as verifyLsag,
} from "./core/lsag.js";
import { computeRingRoot, shortKeyImage } from "./core/ringRoot.js";
import {
  appendAnchor,
  createEmptyRing,
  ensureGhostDir,
  loadAnchors,
  loadIdentity,
  loadOrCreateIdentity,
  loadRing,
  saveRing,
  type AnchorRecord,
  type AnchorsFile,
  type RingConfig,
} from "./core/storage.js";
import { withoutProtocolStdout } from "./stdio.js";

export type RingSummary = {
  ringName: string;
  members: number;
  ringRoot: string;
  context: string;
  entries: Array<{ github: string; publicKey: string; source: string }>;
};

export type CommitSummary = {
  commit: string;
  ringName: string;
  ringRoot: string;
  keyImage: string;
  localAnchorRecorded: boolean;
};

export type VerifySummary = {
  valid: boolean;
  commit: string;
  ringName: string;
  ringRoot: string;
  keyImage: string;
  signerSetSize: number;
  keyImageReuses: string[];
};

function summarizeRing(ring: RingConfig): RingSummary {
  return {
    ringName: ring.name,
    members: ring.members.length,
    ringRoot: computeRingRoot(ring),
    context: `${ring.context.slice(0, 10)}…${ring.context.slice(-6)}`,
    entries: ring.members.map((member) => ({
      github: member.github,
      publicKey: `${member.publicKey.slice(0, 10)}…${member.publicKey.slice(-6)}`,
      source: member.source,
    })),
  };
}

async function currentRepoRoot(): Promise<string> {
  const repo = await openRepo();
  return repo.root;
}

function requireRing(repoRoot: string): RingConfig {
  const ring = loadRing(repoRoot);
  if (!ring) {
    throw new Error("not initialized — run gitghost_init first");
  }
  return ring;
}

function deriveRingContext(ringName: string): string {
  return bytesToHex(
    sha256(new TextEncoder().encode(`gitghost.v1.context|${ringName}`)),
  );
}

export async function initGitghost(input: {
  ringName: string;
}): Promise<{ ring: RingSummary; publicKey: string }> {
  const repoRoot = await currentRepoRoot();
  ensureGhostDir(repoRoot);
  const identityResult = await withoutProtocolStdout(async () =>
    loadOrCreateIdentity(repoRoot),
  );
  const identity = identityResult.value;
  const existingRing = loadRing(repoRoot);
  const ring = existingRing ?? createEmptyRing(input.ringName, deriveRingContext(input.ringName));
  if (!existingRing) {
    saveRing(repoRoot, ring);
  }

  return {
    ring: summarizeRing(ring),
    publicKey: `${identity.publicKey.slice(0, 10)}…${identity.publicKey.slice(-6)}`,
  };
}

export async function addSelfToRing(): Promise<RingSummary> {
  const repoRoot = await currentRepoRoot();
  const ring = requireRing(repoRoot);
  const identity = loadIdentity(repoRoot);
  if (!identity) {
    throw new Error("no local identity — run gitghost_init first");
  }
  if (!ring.members.some((member) => member.publicKey === identity.publicKey)) {
    ring.members = [
      ...ring.members,
      {
        github: "self",
        publicKey: identity.publicKey,
        source: "local",
        fetchedAt: Date.now(),
      },
    ];
    saveRing(repoRoot, ring);
  }
  return summarizeRing(ring);
}

export async function addGithubUserToRing(input: {
  github: string;
}): Promise<RingSummary & { fetchedKeys: number; fingerprint: string }> {
  const repoRoot = await currentRepoRoot();
  const ring = requireRing(repoRoot);
  const github = input.github.replace(/^@/, "").trim();
  if (ring.members.some((member) => member.github.toLowerCase() === github.toLowerCase())) {
    throw new Error(`@${github} is already in the ring`);
  }

  const keys = await fetchGithubKeys(github);
  if (keys.length === 0) {
    throw new Error(`@${github} has no public keys on github`);
  }

  const primary = keys[0];
  if (!primary) {
    throw new Error(`@${github} has no public keys on github`);
  }
  const publicKey = bytesToHex(deriveGhostPublicKey(github, primary.fingerprint));
  ring.members = [
    ...ring.members,
    {
      github,
      publicKey,
      source: "github",
      fetchedAt: Date.now(),
    },
  ];
  saveRing(repoRoot, ring);

  return {
    ...summarizeRing(ring),
    fetchedKeys: keys.length,
    fingerprint: primary.fingerprint,
  };
}

export async function listRing(): Promise<RingSummary> {
  const repoRoot = await currentRepoRoot();
  return summarizeRing(requireRing(repoRoot));
}

export async function commitGhost(input: { message: string }): Promise<CommitSummary> {
  const repo = await openRepo();
  const identity = loadIdentity(repo.root);
  const ring = loadRing(repo.root);
  if (!identity || !ring) {
    throw new Error("not initialized — run gitghost_init first");
  }
  if (ring.members.length < 2) {
    throw new Error("ring needs at least 2 members for anonymity");
  }

  const signerIndex = ring.members.findIndex(
    (member) => member.publicKey === identity.publicKey,
  );
  if (signerIndex < 0) {
    throw new Error("your local identity is not in this ring");
  }

  const canonicalMessage = input.message.trim();
  const ringRoot = computeRingRoot(ring);
  const signature = sign({
    message: new TextEncoder().encode(`${ringRoot}|${canonicalMessage}`),
    ring: ring.members.map((member) => hexToBytes(member.publicKey)),
    signerIndex,
    secret: hexToBytes(identity.secret),
    context: hexToBytes(ring.context),
  });
  const fullMessage = `${canonicalMessage}${formatGhostTrailers({
    ringRoot,
    keyImage: signature.keyImage,
    ringName: ring.name,
    ringSize: ring.members.length,
    signature: serializeSignature(signature),
  })}`;

  const previousCommitterName = process.env.GIT_COMMITTER_NAME;
  const previousCommitterEmail = process.env.GIT_COMMITTER_EMAIL;
  process.env.GIT_COMMITTER_NAME = "ghost";
  process.env.GIT_COMMITTER_EMAIL = "ghost@gitghost.org";

  let commit: string;
  try {
    const status = await repo.git.status();
    const args =
      status.staged.length === 0 &&
      status.created.length === 0 &&
      status.modified.length === 0
        ? ["commit", "--allow-empty", "--author", "ghost <ghost@gitghost.org>", "-m", fullMessage]
        : ["commit", "--author", "ghost <ghost@gitghost.org>", "-m", fullMessage];
    await repo.git.raw(args);
    commit = (await repo.git.revparse(["HEAD"])).trim();
  } finally {
    if (previousCommitterName === undefined) {
      delete process.env.GIT_COMMITTER_NAME;
    } else {
      process.env.GIT_COMMITTER_NAME = previousCommitterName;
    }
    if (previousCommitterEmail === undefined) {
      delete process.env.GIT_COMMITTER_EMAIL;
    } else {
      process.env.GIT_COMMITTER_EMAIL = previousCommitterEmail;
    }
  }

  const anchorRecord: AnchorRecord = {
    commit,
    ringName: ring.name,
    ringRoot,
    keyImage: signature.keyImage,
    signedAt: Date.now(),
  };
  appendAnchor(repo.root, anchorRecord);

  return {
    commit,
    ringName: ring.name,
    ringRoot,
    keyImage: shortKeyImage(signature.keyImage),
    localAnchorRecorded: true,
  };
}

export async function verifyGhostCommit(input: { sha: string }): Promise<VerifySummary> {
  const repo = await openRepo();
  const fullSha = (await repo.git.revparse([input.sha.replace(/^ghost-/, "").trim()])).trim();
  const body = await repo.git.raw(["log", "-1", "--format=%B", fullSha]);
  const trailers = parseGhostTrailers(body);
  if (!trailers.signature || !trailers.ringRoot || !trailers.keyImage) {
    throw new Error("not a ghost commit (missing trailers)");
  }

  const ring = requireRing(repo.root);
  const expectedRoot = computeRingRoot(ring);
  if (expectedRoot !== trailers.ringRoot) {
    throw new Error("ring root mismatch — local ring does not match commit");
  }

  const signature = parseSignature(trailers.signature, ring.members.length);
  const valid = verifyLsag({
    message: new TextEncoder().encode(`${expectedRoot}|${stripGhostTrailers(body)}`),
    ring: ring.members.map((member) => hexToBytes(member.publicKey)),
    context: hexToBytes(ring.context),
    signature,
  });
  const anchors = loadAnchors(repo.root);
  const keyImageReuses = anchors.anchors
    .filter(
      (anchor) =>
        anchor.keyImage === trailers.keyImage &&
        anchor.commit.toLowerCase() !== fullSha.toLowerCase(),
    )
    .map((anchor) => anchor.commit);

  return {
    valid,
    commit: fullSha,
    ringName: ring.name,
    ringRoot: trailers.ringRoot,
    keyImage: shortKeyImage(trailers.keyImage),
    signerSetSize: ring.members.length,
    keyImageReuses,
  };
}

export async function readRingResource(): Promise<RingSummary> {
  return listRing();
}

export async function readAnchorsResource(): Promise<AnchorsFile> {
  const repoRoot = await currentRepoRoot();
  return loadAnchors(repoRoot);
}
