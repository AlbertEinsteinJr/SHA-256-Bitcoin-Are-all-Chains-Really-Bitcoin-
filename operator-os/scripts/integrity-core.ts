// Hash-pin safety-critical files. The self-improvement loop has no write access
// to these; a mismatch means tampering → kernel refuses boot + trips KILL.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

export const PROTECTED_FILES = [
  "CLAUDE.md",
  "src/core/safety.ts",
  "src/core/kernel.ts",
  "src/eval/engine.ts",
  "src/eval/judge.ts",
];

const MANIFEST = join(ROOT, "integrity.manifest.json");

async function sha256(path: string): Promise<string> {
  const buf = await readFile(join(ROOT, path));
  return createHash("sha256").update(buf).digest("hex");
}

export interface IntegrityResult {
  ok: boolean;
  mismatches: string[];
}

export async function verifyIntegrity(): Promise<IntegrityResult> {
  let manifest: Record<string, string> = {};
  try {
    manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    // No manifest yet (pre-freeze). Treat as ok but report.
    return { ok: true, mismatches: [] };
  }
  const mismatches: string[] = [];
  for (const f of PROTECTED_FILES) {
    const want = manifest[f];
    if (!want) continue;
    let got: string;
    try {
      got = await sha256(f);
    } catch {
      mismatches.push(`${f}: missing`);
      continue;
    }
    if (got !== want) mismatches.push(`${f}: hash mismatch`);
  }
  return { ok: mismatches.length === 0, mismatches };
}

export async function writeManifest(): Promise<Record<string, string>> {
  const manifest: Record<string, string> = {};
  for (const f of PROTECTED_FILES) {
    try {
      manifest[f] = await sha256(f);
    } catch {
      /* skip files not yet present */
    }
  }
  const { writeFile } = await import("node:fs/promises");
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}
