# RigDispatch / RoadService.App — Launch Readiness (T-60)

> **⛔ SUPERSEDED 2026-08-18 by the Master Launch Harness (see
> `LAUNCH_HARNESS_EXECUTION_2026-08-18.md`).** This document declares the *dispatch marketplace*
> launch-ready. Coordinated roadside service (requests, bids, dispatch, work orders, managed
> payments) has since been **removed from the release scope**. Do not act on the "GO" below or on
> its recommendations; the launch cohort is now the public directory + Business Hub only.

## GO — current production is launch-ready
- 5 apps deployed & production READY (driver, mechanic, dispatcher, api, directory).
- Directory live: HTTP 200, now **10 real listings** (9 external TX + Alberts), 0 demo rows public.
- Database security hardening applied + advisors clean (see AUDIT_AND_REMEDIATION.md).
- Core payment flow (legacy reverse-auction) proven with real `paid_out` transactions before purge.

## Seed purge — DONE (this session, via Supabase MCP)
Migration `golive_backup_and_purge_seed_data` applied atomically:
- Backed up 32 tables to schema `rd_backup_golive` (instant restore source).
- Removed 7 internal demo directory listings (+ their placements/events/contacts); kept
  "Alberts Roadside Service" and all 9 external real TX listings.
- Purged the entire seed rigdispatch graph: 10 test drivers, 9 test mechanics + profiles,
  6 requests, 4 offers, 4 transactions, payment intents/events, messages, audit log,
  customer accounts/seats/trucks/trailers, 3 test shops. Kept the real Alberts shop.

Post-purge verified: drivers=0, mechanics=0, requests=0, transactions=0, customer_accounts=0,
shops=1, directory live=10 (internal kept=1, external=9).

To restore if needed: tables are in `rd_backup_golive.*` — `INSERT INTO public.x SELECT * FROM rd_backup_golive.x`.

## Launch-time recommendations
1. **Keep `NEXT_PUBLIC_WORKORDER_FLOW` OFF.** The new deposit-first flow is unproven with real money;
   launch on the legacy flow and enable work-order as a controlled fast-follow.
2. **Directory paid upgrade = fast-follow.** Free listings + "upgrade" funnel are live; verify the Stripe
   subscription path in the first hours (subscription→tier flip is app-side; no DB trigger).
3. Optional 1-min hardening: enable Supabase leaked-password protection.

## Still owner-only (not launch-blocking)
- #6 leaked-password toggle (Supabase Auth dashboard).
- #1 spatial_ref_sys advisory (PostGIS-owned; accept or Supabase support).
- #7/#8 directory→payment-branch deploy + work-order flag — only if/when you choose the new flow.
