// Branded ID types — stop agents passing the wrong UUID into the wrong function.
export type Brand<T, B> = T & { readonly __brand: B };

export type RunId = Brand<string, "RunId">;
export type EvalId = Brand<string, "EvalId">;
export type SkillId = Brand<string, "SkillId">;
export type VariantId = Brand<string, "VariantId">;
export type AuditId = Brand<string, "AuditId">;
export type SuiteId = Brand<string, "SuiteId">;

export const asRunId = (s: string): RunId => s as RunId;
export const asEvalId = (s: string): EvalId => s as EvalId;
export const asSkillId = (s: string): SkillId => s as SkillId;
export const asVariantId = (s: string): VariantId => s as VariantId;
export const asAuditId = (s: string): AuditId => s as AuditId;
export const asSuiteId = (s: string): SuiteId => s as SuiteId;
