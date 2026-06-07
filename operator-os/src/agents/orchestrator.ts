// Subagents are isolated: each gets a self-contained task, an explicit output
// schema, and a fresh context. A dedicated verification pass is always last (§2).
import { z } from "zod";
import { validate, withReflection } from "../core/reliability";

export interface SubagentTask<T> {
  name: string;
  schema: z.ZodType<T>;
  run: (attempt: number) => Promise<unknown>;
  verify?: (result: T) => Promise<boolean>;
}

export async function runSubagent<T>(task: SubagentTask<T>): Promise<T> {
  const { value } = await withReflection(async (attempt) => {
    const raw = await task.run(attempt);
    const result = validate(task.schema, raw); // boundary validation
    if (task.verify && !(await task.verify(result))) {
      throw new Error(`subagent ${task.name} failed verification`);
    }
    return result;
  });
  return value;
}
