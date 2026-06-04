# RigDispatch / RoadService.App — Go-Live Runbook (remaining items)

Everything database-side is DONE and verified (see AUDIT_AND_REMEDIATION.md). The items below could not
be executed from the audit session because they require tools/scope that session did not have
(the `rigdispatch` repo, Vercel env editing, Stripe, Supabase Auth config, PostGIS table ownership).
Each step here is turn-key.

Live status confirmed 2026-06-03: directory production deployment serves HTTP 200 with the full
state/service browse + "List your shop" (/advertise) CTA; 17 live listings; security headers present
(CSP, HSTS, X-Frame-Options DENY).

---

## 1. spatial_ref_sys RLS (advisory ERROR #1)  — Supabase, ~2 min
The migration role can't `ALTER` this PostGIS-owned table. Options:
- **Accept** (lowest effort): it holds only public SRID reference data — no sensitive rows. Document as a
  known/accepted advisory.
- **Or** open a Supabase support request to enable RLS on `public.spatial_ref_sys`, or move PostGIS to a
  dedicated `extensions` schema (also addresses the `extension_in_public` warnings).

## 2. Leaked-password protection (advisory WARN #6) — Supabase dashboard, ~1 min
Dashboard → Authentication → Policies/Passwords → enable **Leaked password protection** (HaveIBeenPwned).
Optionally also set Auth → "percentage-based" DB connections (perf advisory).

## 3. Deploy directory to the payment branch (#7) — needs `rigdispatch` repo, ~5 min
The directory production alias is still on `feat/war-room-schema`; driver/mechanic/dispatcher/api are on
`feat/payment-workorder`. Bring directory in line:
```bash
# from a checkout of albertsroadservice/rigdispatch
git checkout feat/payment-workorder && git pull
# either merge to the production branch and let Vercel auto-deploy, or:
vercel --prod --scope albertsroadservices-projects   # in apps/directory (or via Vercel dashboard → Deploy)
```
Verify: `list_deployments(rigdispatch-directory)` top item `state:READY`, `target:production`,
`githubCommitRef: feat/payment-workorder`.

## 4. Enable the work-order flow (#8) — Vercel env, ~3 min
For projects rigdispatch-driver, rigdispatch-mechanic, rigdispatch-dispatcher, rigdispatch-api:
Vercel → Project → Settings → Environment Variables → set `NEXT_PUBLIC_WORKORDER_FLOW=1` (Production) →
redeploy. (Leave at `0` to keep the legacy reverse-auction flow.)

## 5. Directory paid-subscription end-to-end test (#3) — needs deploy + Stripe, ~10 min
The subscription → `dir_placements.tier` upgrade is APP-SIDE (no DB trigger), so it must be exercised
through the deployed app + Stripe webhook:
1. On directory.roadservice.app, claim a listing → /advertise → start a paid plan (Stripe Checkout).
2. Complete payment (Stripe test card 4242 4242 4242 4242 in test mode, or a real card in live mode).
3. Confirm in DB:
   ```sql
   select * from dir_subscriptions order by created_at desc limit 1;          -- row exists, status active
   select tier,status from dir_placements where listing_id = '<the listing>';  -- tier upgraded from 'free'
   select * from dir_subscription_status('<dashboard_token>');                 -- returns the sub
   ```
4. If the tier does not upgrade, the gap is in the Stripe webhook handler (app code), not the DB.

## 6. Seed-data purge (#9) — Supabase, at cutover only
Run `migrations/09_seed_purge.sql` (currently commented out). Back up to `rd_backup_golive` first; scope
the DELETEs to known test ids. Keep any real claimed/paid directory listings.

## 7. Final go-live
- Switch Stripe to **live** keys (driver/mechanic/dispatcher/api/directory env).
- Confirm production domains: roadservice.app (marketing), app/driver/mechanic/dispatcher subdomains,
  directory.roadservice.app.
- Smoke test: customer request → dispatch match → payment; mechanic onboarding; directory claim + paid
  upgrade.
- Re-run `get_advisors(security)` and `get_advisors(performance)`; announce live.

---

### To have me finish 3–7 automatically
Start a NEW Claude Code session whose repository scope includes `albertsroadservice/rigdispatch`
(and, ideally, Stripe + Vercel env access), then say "continue the RigDispatch go-live from PR #3".
A session's tool/repository scope is fixed at start, so this cannot be changed inside the current session.
