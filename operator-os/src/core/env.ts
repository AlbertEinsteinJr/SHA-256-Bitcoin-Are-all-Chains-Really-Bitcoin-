// Typed, fail-fast env. Splits server-only secrets from public values.
import { z } from "zod";

const Schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  VOYAGE_API_KEY: z.string().optional(),
  OPERATOR_TZ: z.string().default("UTC"),
  LOOP_MAX_ITERATIONS: z.coerce.number().int().positive().default(20),
  LOOP_SPEND_CAP_USD: z.coerce.number().positive().default(5),
  LOOP_RATE_PER_MIN: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof Schema>;

let cached: Env | null = null;
export function env(): Env {
  if (!cached) cached = Schema.parse(process.env);
  return cached;
}

export const hasSupabase = () =>
  Boolean(env().NEXT_PUBLIC_SUPABASE_URL && env().NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const hasAnthropic = () => Boolean(env().ANTHROPIC_API_KEY);
export const hasVoyage = () => Boolean(env().VOYAGE_API_KEY);
