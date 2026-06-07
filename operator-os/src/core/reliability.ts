// Reliability runtime — CLAUDE.md §2 made code.
import { z } from "zod";
import { ValidationError } from "../contracts/index";

/** Validate structured output at every boundary. Throws on invalid. */
export function validate<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new ValidationError("boundary validation failed", { issues: r.error.issues });
  }
  return r.data;
}

export interface ReflectionResult<T> {
  value: T;
  attempts: number;
  failures: string[];
}

/** Run fn; on failure write a short analysis and retry up to maxRetries (default 1). */
export async function withReflection<T>(
  fn: (attempt: number, lastError?: string) => Promise<T>,
  opts: { maxRetries?: number } = {},
): Promise<ReflectionResult<T>> {
  const maxRetries = opts.maxRetries ?? 1;
  const failures: string[] = [];
  let lastError: string | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const value = await fn(attempt, lastError);
      return { value, attempts: attempt + 1, failures };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      failures.push(`attempt ${attempt}: ${lastError}`);
    }
  }
  throw new Error(`withReflection exhausted ${maxRetries + 1} attempts: ${failures.join(" | ")}`);
}

export type Step<C> = {
  name: string;
  run: (ctx: C) => Promise<C>;
};

/**
 * Enforce ≤5 sequential steps; insert verification callback slots at index 2 and 4.
 * Prefer parallel()/DAGs over long chains — see §2.
 */
export async function chain<C>(
  steps: Step<C>[],
  initial: C,
  verify?: (ctx: C, index: number) => Promise<void>,
): Promise<C> {
  if (steps.length > 5) {
    throw new Error(`chain exceeds 5 steps (${steps.length}); decompose into a DAG`);
  }
  let ctx = initial;
  for (let i = 0; i < steps.length; i++) {
    ctx = await steps[i]!.run(ctx);
    if ((i === 2 || i === 4) && verify) await verify(ctx, i);
  }
  return ctx;
}

/** Run independent branches concurrently (DAG-over-linear). */
export async function parallel<T>(branches: Array<() => Promise<T>>, concurrency = 4): Promise<T[]> {
  const results: T[] = new Array(branches.length);
  let cursor = 0;
  async function worker() {
    while (cursor < branches.length) {
      const i = cursor++;
      results[i] = await branches[i]!();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, branches.length) }, worker));
  return results;
}
