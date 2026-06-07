-- Operator OS — initial schema (Postgres 17)
-- War-room-hardened: integer micro-USD money, CAS concurrency, append-only
-- hash-chained audit, atomic caps, durable job queue (no daemon).
--
-- Conventions:
--   * All money is integer micro-USD (1 USD = 1_000_000) to avoid float drift.
--   * Singleton control tables use `id boolean primary key default true check (id)`.
--   * Optimistic concurrency via a `version bigint` column + WHERE-guarded UPDATE.

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists vector;     -- pgvector (skill embeddings)

-- ============================================================================
-- CONTROL PLANE: kill switch, budget, rate ledger
-- ============================================================================

create table system_flags (
  id           boolean primary key default true check (id),
  halted       boolean not null default false,
  halt_reason  text,
  halted_at    timestamptz,
  heartbeat_at timestamptz,                 -- dead-man switch: worker must touch this
  version      bigint not null default 0
);
insert into system_flags (id) values (true);

create table budget (
  id                  boolean primary key default true check (id),
  cap_micro_usd       bigint not null default 5000000,   -- $5 default loop cap
  spent_micro_usd     bigint not null default 0,
  reserved_micro_usd  bigint not null default 0,
  window_start        timestamptz not null default now(),
  version             bigint not null default 0
);
insert into budget (id) values (true);

-- Spend + rate ledger. Windowed COUNT(*) for rate limiting; SUM for spend audit.
create table api_calls (
  id              uuid primary key default gen_random_uuid(),
  ts              timestamptz not null default now(),
  kind            text not null,                 -- 'anthropic' | 'voyage' | 'judge'
  model           text,
  input_tokens    bigint not null default 0,
  output_tokens   bigint not null default 0,
  cost_micro_usd  bigint not null default 0,
  loop_run_id     uuid,
  correlation_id  text,
  idempotency_key text unique                    -- dedupe retried calls
);
create index api_calls_ts_idx on api_calls (ts);
create index api_calls_loop_idx on api_calls (loop_run_id);

-- Atomic spend reservation: returns 1 row if reservation fit under cap, else 0.
create or replace function reserve_spend(p_amount bigint) returns boolean
language plpgsql as $$
declare ok boolean;
begin
  update budget
     set reserved_micro_usd = reserved_micro_usd + p_amount,
         version = version + 1
   where id = true
     and spent_micro_usd + reserved_micro_usd + p_amount <= cap_micro_usd;
  get diagnostics ok = row_count;
  return ok > 0;
end $$;

-- Settle an actual cost against a prior reservation.
create or replace function settle_spend(p_reserved bigint, p_actual bigint) returns void
language plpgsql as $$
begin
  update budget
     set reserved_micro_usd = greatest(0, reserved_micro_usd - p_reserved),
         spent_micro_usd     = spent_micro_usd + p_actual,
         version             = version + 1
   where id = true;
end $$;

-- ============================================================================
-- DURABLE JOB QUEUE (replaces the impossible serverless daemon)
-- One row per loop step; drained with FOR UPDATE SKIP LOCKED.
-- ============================================================================

create table job_queue (
  id            uuid primary key default gen_random_uuid(),
  step          text not null,             -- loop.start | eval.baseline | ...
  payload       jsonb not null default '{}'::jsonb,
  run_at        timestamptz not null default now(),
  locked_at     timestamptz,
  locked_by     text,
  attempts      int not null default 0,
  max_attempts  int not null default 5,
  status        text not null default 'pending', -- pending|running|done|failed|dead
  last_error    text,
  dedupe_key    text unique,               -- effectively-once enqueue
  created_at    timestamptz not null default now()
);
create index job_queue_ready_idx on job_queue (run_at) where status = 'pending';

-- Claim the next ready job atomically.
create or replace function claim_job(p_worker text) returns setof job_queue
language plpgsql as $$
begin
  return query
  update job_queue j
     set status = 'running', locked_at = now(), locked_by = p_worker, attempts = attempts + 1
   where j.id = (
     select id from job_queue
      where status = 'pending' and run_at <= now()
      order by run_at
      for update skip locked
      limit 1)
  returning j.*;
end $$;

-- ============================================================================
-- EVAL SUBSTRATE
-- ============================================================================

create table eval_suites (
  id            uuid primary key default gen_random_uuid(),
  component     text not null,
  suite_hash    text not null unique,      -- hash(ordered cases + judge_version)
  judge_version text not null,
  case_count    int not null,
  created_at    timestamptz not null default now()
);

create table eval_runs (
  id              uuid primary key default gen_random_uuid(),
  loop_run_id     uuid,
  component       text not null,
  subject_kind    text not null,           -- baseline | variant | best | adhoc
  subject_id      text not null,
  suite_id        uuid not null references eval_suites(id),
  suite_hash      text not null,
  passed          int  not null,
  total           int  not null,
  det_passed      int  not null default 0, -- deterministic subset (anti-reward-hack gate)
  det_total       int  not null default 0,
  judge_passed    int  not null default 0,
  judge_total     int  not null default 0,
  holdout_passed  int  not null default 0, -- secret gold holdout
  holdout_total   int  not null default 0,
  cost_micro_usd  bigint not null default 0,
  duration_ms     int  not null default 0,
  judge_raw       jsonb not null default '[]'::jsonb,
  status          text not null default 'complete',
  idempotency_key text not null unique,
  created_at      timestamptz not null default now(),
  constraint eval_counts_chk check (passed <= total and det_passed <= det_total)
);
create index eval_runs_loop_idx on eval_runs (loop_run_id, subject_kind);
create index eval_runs_component_idx on eval_runs (component, created_at);

-- The contested "best.json" — a single CAS-guarded row, never a file.
create table best_pointer (
  component   text primary key,
  eval_run_id uuid not null references eval_runs(id),
  passed      int not null,
  total       int not null,
  suite_hash  text not null,
  version     bigint not null default 0
);

create table best_archive (
  id          uuid primary key default gen_random_uuid(),
  component   text not null,
  label       text not null,                 -- 'v<n>.score<NN>' derived in-txn
  eval_run_id uuid not null references eval_runs(id),
  passed      int not null,
  total       int not null,
  archived_at timestamptz not null default now(),
  unique (component, label)
);

-- ============================================================================
-- SELF-IMPROVEMENT LOOP
-- ============================================================================

create table loop_runs (
  id                uuid primary key default gen_random_uuid(),
  component         text not null,
  session_id        text not null,           -- groups one overnight run
  iteration         int not null,
  status            text not null default 'pending', -- pending|running|promoted|no_change|halted|failed
  current_step      text not null default 'start',
  trigger           text not null default 'manual',  -- manual | cron
  suite_id          uuid references eval_suites(id),
  skillset_version  bigint not null default 0,
  baseline_eval_id  uuid references eval_runs(id),
  promoted_eval_id  uuid references eval_runs(id),
  no_improve_streak int not null default 0,
  cost_micro_usd    bigint not null default 0,
  correlation_id    text,
  idempotency_key   text not null unique,
  version           bigint not null default 0,
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  unique (session_id, iteration)             -- exactly-once per iteration
);

-- Generated variants (the ONLY auto-writable artifact surface besides files).
create table variants (
  id           uuid primary key default gen_random_uuid(),
  loop_run_id  uuid references loop_runs(id),
  component    text not null,
  approach     text not null,                -- short label of the distinct strategy
  body         text not null,                -- prompt/config text
  diversity_ok boolean not null default true,
  eval_run_id  uuid references eval_runs(id),
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- SKILL LIBRARY (Voyager: admit only if verified + passing eval)
-- ============================================================================

create table skills (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  version       int  not null default 1,
  parent_id     uuid references skills(id),  -- lineage
  description   text not null,
  body          text not null,
  language      text not null default 'ts',
  embedding     vector(1024),                -- Voyage dim
  verified      boolean not null default false,
  eval_score    int,                         -- passed count at admission
  admit_eval_id uuid references eval_runs(id),
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (name, version),
  constraint skills_admit_chk check (not verified or (eval_score is not null))
);
create index skills_embedding_idx on skills using hnsw (embedding vector_cosine_ops);
create index skills_name_idx on skills (name, archived);

-- Top-k semantic search (supabase-js cannot express the <=> operator directly).
create or replace function match_skills(query_embedding vector(1024), match_count int)
returns table (id uuid, name text, description text, similarity float)
language sql stable as $$
  select s.id, s.name, s.description,
         1 - (s.embedding <=> query_embedding) as similarity
    from skills s
   where s.archived = false and s.verified = true and s.embedding is not null
   order by s.embedding <=> query_embedding
   limit match_count;
$$;

-- ============================================================================
-- APPEND-ONLY, HASH-CHAINED AUDIT LOG
-- ============================================================================

create table audit_log (
  id             bigint generated always as identity primary key,
  ts             timestamptz not null default now(),
  actor          text not null,               -- human:<email> | loop | eval | api | cli | agent
  action         text not null,
  entity_type    text,
  entity_id      text,
  before_state   jsonb,
  after_state    jsonb,
  reason         text,
  cost_micro_usd bigint not null default 0,
  approval_nonce text,                         -- token id only; never the secret
  source         text not null default 'real',-- real | simulated
  correlation_id text,
  prev_hash      text,
  entry_hash     text not null
);
create index audit_log_ts_idx on audit_log (ts);
create index audit_log_corr_idx on audit_log (correlation_id);

-- Maintain the hash chain on insert (tamper-evidence even vs a privileged actor).
create or replace function audit_chain() returns trigger
language plpgsql as $$
declare last_hash text;
begin
  select entry_hash into last_hash from audit_log order by id desc limit 1;
  new.prev_hash := last_hash;
  new.entry_hash := encode(digest(
    coalesce(last_hash,'') ||
    new.actor || new.action || coalesce(new.entity_id,'') ||
    coalesce(new.after_state::text,'') || new.ts::text, 'sha256'), 'hex');
  return new;
end $$;
create trigger audit_chain_tg before insert on audit_log
  for each row execute function audit_chain();

-- Block UPDATE/DELETE for ALL roles (incl service_role, which bypasses RLS).
create or replace function audit_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only (% blocked)', tg_op;
end $$;
create trigger audit_no_update_tg before update or delete on audit_log
  for each row execute function audit_immutable();
revoke truncate on audit_log from public;

-- ============================================================================
-- FLYWHEEL — Breakdown/Repair Graph + business spine (the moat)
-- ============================================================================

create table fleets (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  region     text,
  sla_tier   text not null default 'standard',
  created_at timestamptz not null default now()
);

create table assets (
  id         uuid primary key default gen_random_uuid(),
  fleet_id   uuid references fleets(id),
  asset_type text not null,                   -- truck | trailer
  make       text, model text, year int,
  unit_no    text, vin text, region text,
  mileage    int,
  created_at timestamptz not null default now()
);

create table call_intents (
  id             uuid primary key default gen_random_uuid(),
  source_call_id text,
  raw_transcript text not null,
  extracted      jsonb not null,
  confidence     numeric,
  model_version  text,
  source         text not null default 'simulated', -- simulated | vapi
  correlation_id text,
  created_at     timestamptz not null default now()
);

-- THE MOAT SIGNAL: every operator correction becomes a labeled training case.
create table intent_corrections (
  id             uuid primary key default gen_random_uuid(),
  call_intent_id uuid references call_intents(id),
  field          text not null,
  old_value      text,
  new_value      text,
  corrected_by   text not null,
  created_at     timestamptz not null default now()
);

create table breakdowns (
  id            uuid primary key default gen_random_uuid(),
  asset_id      uuid references assets(id),
  fleet_id      uuid references fleets(id),
  location_geo  text,
  truck_make    text, truck_model text,
  symptom       text not null,
  component     text,
  severity      text not null default 'medium',
  region        text,
  source        text not null default 'dispatch', -- directory|dispatch|inspection
  source_call_id uuid references call_intents(id),
  predicted_breakdown_id uuid,
  correlation_id text,
  created_at    timestamptz not null default now()
);

create table dispatches (
  id               uuid primary key default gen_random_uuid(),
  breakdown_id     uuid references breakdowns(id),
  mechanic_id      text,
  status           text not null default 'new', -- new|triage|dispatched|enroute|onsite|resolved|billed
  dispatched_at    timestamptz,
  on_site_at       timestamptz,
  resolved_at      timestamptz,
  response_min     int,
  repair_min       int,
  parts_used       jsonb,
  price_cents      int,
  rating           int,
  outcome          text,
  region           text,
  sla_target_min   int,
  sla_met          boolean,
  correlation_id   text,
  created_at       timestamptz not null default now()
);

create table inspections (
  id          uuid primary key default gen_random_uuid(),
  fleet_id    uuid references fleets(id),
  asset_id    uuid references assets(id),
  truck_make  text, truck_model text, mileage int,
  inspector   text,
  defects     jsonb,
  created_at  timestamptz not null default now()
);

create table inspection_defects (
  id                 uuid primary key default gen_random_uuid(),
  inspection_id      uuid references inspections(id),
  asset_id           uuid references assets(id),
  component          text not null,
  severity           text not null default 'medium',
  recommended_action text,
  resolved           boolean not null default false,
  created_at         timestamptz not null default now()
);

create table predicted_breakdowns (
  id                  uuid primary key default gen_random_uuid(),
  asset_id            uuid references assets(id),
  component           text not null,
  window_start        timestamptz,
  window_end          timestamptz,
  probability         numeric not null,
  model_version       text,
  actual_breakdown_id uuid references breakdowns(id),
  outcome             text not null default 'pending', -- pending|hit|miss
  generated_at        timestamptz not null default now()
);

create table parts (
  id   uuid primary key default gen_random_uuid(),
  sku  text unique, name text not null
);
create table dispatch_parts (
  dispatch_id uuid references dispatches(id),
  part_id     uuid references parts(id),
  qty         int not null default 1,
  cost_cents  int,
  primary key (dispatch_id, part_id)
);

create table directory_conversions (
  id            uuid primary key default gen_random_uuid(),
  page_slug     text not null,
  query         text,
  location_geo  text,
  channel       text,                        -- rankradar | shopbid | quotedrop
  converted     boolean not null default false,
  converted_to_breakdown_id uuid references breakdowns(id),
  created_at    timestamptz not null default now()
);

-- Cost ledger (first-class $; powers the owner page + budget-cap-trips-KILL).
create table cost_ledger (
  id             uuid primary key default gen_random_uuid(),
  ts             timestamptz not null default now(),
  category       text not null,               -- loop_run|eval_run|inference|embedding
  ref_id         text,
  component      text,
  model          text,
  input_tokens   bigint not null default 0,
  output_tokens  bigint not null default 0,
  cost_micro_usd bigint not null default 0
);
create index cost_ledger_ts_idx on cost_ledger (ts);

-- ============================================================================
-- MATERIALIZED-ish reporting views (the 5 canonical owner queries)
-- (plain views; promote to matviews later if needed)
-- ============================================================================

create view v_response_time_by_region as
  select region, count(*) as dispatches,
         round(avg(response_min)::numeric, 1) as avg_response_min,
         sum((sla_met)::int)::float / nullif(count(*),0) as sla_rate
    from dispatches where response_min is not null
   group by region;

create view v_parts_used as
  select p.sku, p.name, sum(dp.qty) as qty_used, sum(dp.cost_cents) as cost_cents
    from dispatch_parts dp join parts p on p.id = dp.part_id
   group by p.sku, p.name order by qty_used desc;

create view v_conversion_by_directory as
  select page_slug, channel, count(*) as visits,
         sum((converted)::int) as conversions,
         sum((converted)::int)::float / nullif(count(*),0) as conversion_rate
    from directory_conversions group by page_slug, channel;

create view v_predicted_breakdowns_30d as
  select pb.*, a.unit_no, a.make, a.model, f.name as fleet_name
    from predicted_breakdowns pb
    join assets a on a.id = pb.asset_id
    left join fleets f on f.id = a.fleet_id
   where pb.outcome = 'pending'
     and pb.window_start <= now() + interval '30 days'
   order by pb.probability desc;

create view v_correction_rate as
  select ci.model_version,
         count(distinct ci.id) as intents,
         count(distinct ic.call_intent_id) as corrected,
         count(distinct ic.call_intent_id)::float / nullif(count(distinct ci.id),0) as correction_rate
    from call_intents ci
    left join intent_corrections ic on ic.call_intent_id = ci.id
   group by ci.model_version;
