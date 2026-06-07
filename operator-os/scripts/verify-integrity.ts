import { verifyIntegrity, writeManifest } from "./integrity-core";

async function main() {
  if (process.argv.includes("--write")) {
    const m = await writeManifest();
    console.log(`integrity manifest written (${Object.keys(m).length} files)`);
    return;
  }
  const r = await verifyIntegrity();
  if (r.ok) {
    console.log("integrity OK");
  } else {
    console.error("integrity FAILED:", r.mismatches.join(", "));
    process.exit(1);
  }
}
main();
