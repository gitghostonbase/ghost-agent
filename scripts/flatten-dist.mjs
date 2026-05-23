import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";

const sourceRoot = "dist-build";
const targetRoot = "dist";

rmSync(targetRoot, { recursive: true, force: true });
mkdirSync(targetRoot, { recursive: true });

if (existsSync(sourceRoot)) {
  cpSync(sourceRoot, targetRoot, { recursive: true });
}

rmSync(`${targetRoot}/test`, { recursive: true, force: true });

rmSync(sourceRoot, { recursive: true, force: true });
