// Supabase-backed DbClient. Atomic ops (reserve_spend, claim_job, match_skills)
// go through Postgres functions via rpc(); CRUD via PostgREST.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DbClient } from "../../contracts/index";
import { ExternalServiceError, NotFoundError } from "../../contracts/index";
import { env } from "../env";

export class SupabaseDbClient implements DbClient {
  constructor(private readonly sb: SupabaseClient) {}

  async query<T = unknown>(_sql: string, _params?: unknown[]): Promise<T[]> {
    throw new ExternalServiceError(
      "raw SQL not available via PostgREST; use rpc()/insert()/selectOne() or a direct pg connection in the worker",
    );
  }

  async rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.rpc(fn, args);
    if (error) throw new ExternalServiceError(`rpc ${fn} failed: ${error.message}`, { cause: error });
    return data as T;
  }

  async insert<T = unknown>(table: string, row: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.from(table).insert(row).select().single();
    if (error) throw new ExternalServiceError(`insert ${table} failed: ${error.message}`, { cause: error });
    return data as T;
  }

  async selectOne<T = unknown>(table: string, match: Record<string, unknown>): Promise<T | null> {
    const { data, error } = await this.sb.from(table).select("*").match(match).maybeSingle();
    if (error) throw new ExternalServiceError(`select ${table} failed: ${error.message}`, { cause: error });
    return (data as T) ?? null;
  }

  raw(): SupabaseClient {
    return this.sb;
  }
}

export function createSupabaseDb(serverSide = true): SupabaseDbClient {
  const e = env();
  const url = e.NEXT_PUBLIC_SUPABASE_URL;
  const key = serverSide
    ? (e.SUPABASE_SERVICE_ROLE_KEY ?? e.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new NotFoundError("Supabase env not configured");
  return new SupabaseDbClient(createClient(url, key, { auth: { persistSession: false } }));
}
