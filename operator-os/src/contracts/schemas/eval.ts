import { z } from "zod";

// An assertion is either a deterministic predicate (referenced by name) or a
// judge rubric. Deterministic + secret-holdout gate promotion; the judge informs.
export const Assertion = z.object({
  kind: z.enum(["deterministic", "judge"]),
  // For deterministic: the name of a registered predicate. For judge: the rubric.
  check: z.string(),
  why: z.string(),
  holdout: z.boolean().default(false), // part of the secret gold set
});
export type Assertion = z.infer<typeof Assertion>;

export const EvalCase = z.object({
  id: z.string(),
  input: z.unknown(),
  assert: Assertion,
  // optional gold expectation for deterministic/holdout scoring
  expected: z.unknown().optional(),
});
export type EvalCase = z.infer<typeof EvalCase>;

export const EvalSuiteFile = z.object({
  component: z.string(),
  judgeVersion: z.string(),
  cases: z.array(EvalCase),
});
export type EvalSuiteFile = z.infer<typeof EvalSuiteFile>;

// The strict, binary verdict the judge must return (structured output).
export const JudgeVerdict = z.object({
  pass: z.boolean(),
  evidence: z.string(),
});
export type JudgeVerdict = z.infer<typeof JudgeVerdict>;

export const CaseResult = z.object({
  caseId: z.string(),
  pass: z.boolean(),
  inconclusive: z.boolean().default(false),
  kind: z.enum(["deterministic", "judge"]),
  holdout: z.boolean().default(false),
  evidence: z.string().optional(),
});
export type CaseResult = z.infer<typeof CaseResult>;

export const EvalResult = z.object({
  component: z.string(),
  suiteHash: z.string(),
  passed: z.number().int(),
  total: z.number().int(),
  detPassed: z.number().int(),
  detTotal: z.number().int(),
  judgePassed: z.number().int(),
  judgeTotal: z.number().int(),
  holdoutPassed: z.number().int(),
  holdoutTotal: z.number().int(),
  costMicroUsd: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  cases: z.array(CaseResult),
});
export type EvalResult = z.infer<typeof EvalResult>;

// Rational comparison: a beats b iff passed_a/total_a > passed_b/total_b (strict).
export function beats(a: { passed: number; total: number }, b: { passed: number; total: number }): boolean {
  return a.passed * b.total > b.passed * a.total;
}
