# RigDispatch / RoadService.App — Audit & Launch-Hardening Record

**Date:** 2026-06-03
**Supabase project:** `rlxgltbiotpmtmfxlfht` ("albertsroadservice's Project")
**Vercel team:** `albertsroadservices-projects` (`team_2BstI1BjhxBYRswaG6TtOLT2`)
**Source repo (app):** `albertsroadservice/rigdispatch` (private)

> NOTE: This audit repo (`SHA-256-...`) is unrelated to the product; it is only the workspace this
> session had write access to. The findings/migrations below were applied directly to the live Supabase
> project via MCP. The SQL is mirrored under `migrations/` so it can be committed into the real
> `rigdispatch` repo's migration history.

## System map
| Layer | Component |
|-------|-----------|
| Customer app | Vercel `rigdispatch-driver` |
| Mechanic app | Vercel `rigdispatch-mechanic` |
| Admin dispatch | Vercel `rigdispatch-dispatcher` |
| Shared API | Vercel `rigdispatch-api` |
| Directory | Vercel `rigdispatch-directory` |
| Marketing/home | Vercel `rigdispatch-marketing`, `rigdispatch-home` |
| Backend | Supabase `rlxgltbiotpmtmfxlfht` (Postgres 17 + PostGIS) |

Core flow verified working in prod data: 4 `paid_out` requests, 4 transactions, 4 payment intents,
4 approved/live shops. New deposit-first work-order system is built but gated behind
`NEXT_PUBLIC_WORKORDER_FLOW`.

## Priority items — status after this session

| # | Item | Status |
|---|------|--------|
| 1 | `spatial_ref_sys` RLS | ⛔ Blocked — table owned by PostGIS superuser; `ALTER` denied to migration role. Needs Supabase dashboard/support. Low risk (public SRID reference data). |
| 2 | RLS policies for `dir_subscriptions` / `dir_listing_contacts` | ✅ Applied (`a2`). Service-role write policies + token-keyed read RPC `dir_subscription_status`. |
| 3 | Directory paid-sub end-to-end test | ⚠️ DB side done (RPC + read-back verified). Subscription→`dir_placements.tier` flip is **app-side** (no DB trigger), so the live Stripe run needs the repo + Stripe keys. |
| 4 | `search_path` on flagged functions | ✅ Applied (`a3`). All `function_search_path_mutable` warnings cleared. |
| 5 | Revoke anon EXECUTE on security-definer funcs | ✅ Applied (`a4`/`a4b`/`a4c`). anon execute cleared on `can_access_job`, `is_admin`, `has_role`, `current_user_id`, `is_fleet_manager`, `is_fleet_member`, `dir_subscription_status`. |
| 6 | Leaked-password protection | ⛔ Dashboard toggle (Auth → Passwords). No MCP tool. |
| 7 | Deploy `rigdispatch-directory` to `feat/payment-workorder` | ⛔ Needs `rigdispatch` repo in GitHub scope. |
| 8 | Enable `NEXT_PUBLIC_WORKORDER_FLOW` in prod | ⛔ Vercel env / repo config. |
| 9 | Purge seed data | ⏸️ Deferred to go-live per instruction; SQL staged in `migrations/09_seed_purge.sql` (NOT applied). |
| 10 | Consolidate duplicate permissive policies | ✅ Applied (`a5`). `multiple_permissive_policies` = 0, `auth_rls_initplan` = 0. |

## Verification performed
- `get_advisors(security)`: cleared all `rls_enabled_no_policy`, `function_search_path_mutable`, and the
  anon `SECURITY DEFINER` execute warnings for app/auth/fleet helpers.
- `get_advisors(performance)`: `multiple_permissive_policies` and `auth_rls_initplan` both 0.
- RLS read-back as `anon`: `dir_subscriptions` → 0 rows; non-live `dir_listings` → 0 rows; live
  listings → 17 (correct public-directory behavior).

## Knowingly-accepted remaining advisories
- `authenticated_security_definer_function_executable` on the RLS helper functions — **by design**:
  these must be executable by `authenticated` because RLS policies call them. Removing the grant would
  break row-level security.
- `anon` execute on `dir_listing_stats(p_token)` / `dir_listing_reviews(p_listing_id)` — **by design**:
  public directory dashboards (token-gated) and public reviews.
- `st_estimatedextent` (PostGIS C functions) — owned by superuser, cannot revoke; harmless.
- `extension_in_public` (postgis, pg_trgm) — moving schemas on managed Supabase is risky; low priority.
- `unindexed_foreign_keys`, `unused_index`, `no_primary_key` (backup schema) — INFO, post-launch cleanup.

## Still requires action (outside this session's reach)
1. Add `albertsroadservice/rigdispatch` to the session's GitHub scope → enables #3 (live), #7, #8.
2. Supabase dashboard: enable leaked-password protection (#6); fix `spatial_ref_sys` RLS (#1, via
   support/owner); optionally switch Auth to percentage-based DB connections.
3. Go-live sequence (#9 + Stripe live keys + domains + final smoke test) — run `migrations/09_seed_purge.sql`
   only at cutover.
