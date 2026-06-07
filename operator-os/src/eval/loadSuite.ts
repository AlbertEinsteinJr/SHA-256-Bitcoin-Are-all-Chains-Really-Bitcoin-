import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { EvalSuiteFile } from "../contracts/schemas/eval";
import { validate } from "../core/reliability";

const HERE = dirname(fileURLToPath(import.meta.url));

export async function loadSuite(component: string): Promise<EvalSuiteFile> {
  const path = join(HERE, "suites", `${component}.eval.json`);
  const raw = JSON.parse(await readFile(path, "utf8"));
  return validate(EvalSuiteFile, raw);
}
