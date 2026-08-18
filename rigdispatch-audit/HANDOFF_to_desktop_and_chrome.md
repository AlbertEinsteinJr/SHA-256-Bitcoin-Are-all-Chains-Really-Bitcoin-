# Hand-off brief — finish RigDispatch go-live via Desktop Commander / Claude-in-Chrome

> **⛔ SUPERSEDED 2026-08-18 by the Master Launch Harness (see
> `LAUNCH_HARNESS_EXECUTION_2026-08-18.md`).** Block A below deploys the dispatch apps and enables
> the work-order flow — **out of the release scope now**; do not paste it anywhere. The current
> hand-off runbook is §6 of the execution record.

The database hardening is already applied & verified in production (see AUDIT_AND_REMEDIATION.md / PR #3).
The steps below are the *remaining* items. They need your real logins, so run them in a Claude surface that
has them: **Desktop Commander** (shell + your `gh`/`vercel`/`supabase` CLIs) and/or **Claude-in-Chrome**
(dashboard clicks). Paste the relevant block as the prompt to that agent.

=====================================================================
A) PASTE INTO DESKTOP COMMANDER  (runs on your machine with your CLIs)
=====================================================================
Goal: deploy the directory on the payment branch, enable the work-order flow, and (optionally) run the
Stripe directory-subscription test. Pre-req: `gh auth status` ok; `vercel login` done; `supabase login` done.

1. Clone & branch:
   gh repo clone albertsroadservice/rigdispatch && cd rigdispatch
   git checkout feat/payment-workorder && git pull

2. Link the directory app to its Vercel project and deploy to production:
   cd apps/directory   # adjust if the path differs
   vercel link --project rigdispatch-directory --scope albertsroadservices-projects --yes
   vercel --prod --scope albertsroadservices-projects

3. Enable the work-order flow on the four apps, then redeploy each:
   for app in rigdispatch-driver rigdispatch-mechanic rigdispatch-dispatcher rigdispatch-api; do
     printf '1' | vercel env add NEXT_PUBLIC_WORKORDER_FLOW production --scope albertsroadservices-projects --force "$app"
     vercel --prod --scope albertsroadservices-projects --cwd "apps/${app#rigdispatch-}"   # adjust paths
   done
   # (If the monorepo uses one project per app dir, run `vercel --prod` from each app dir instead.)

4. Verify deployments are READY on feat/payment-workorder (or ask me to check via the Vercel MCP).

=====================================================================
B) PASTE INTO CLAUDE-IN-CHROME  (drives the dashboards by clicking)
=====================================================================
Do these in my browser where I'm already logged in:

1. SUPABASE — leaked-password protection (#6):
   Go to https://supabase.com/dashboard/project/rlxgltbiotpmtmfxlfht/auth/policies
   → Authentication → Sign In / Providers (or Passwords) → turn ON "Leaked password protection" → Save.

2. SUPABASE — (optional) connection strategy:
   Settings → Auth → set DB connections to percentage-based.

3. VERCEL — confirm env + deploy (if not done via CLI):
   For projects rigdispatch-driver, -mechanic, -dispatcher, -api, -directory at
   https://vercel.com/albertsroadservices-projects :
   Settings → Environment Variables → add NEXT_PUBLIC_WORKORDER_FLOW = 1 (Production) →
   Deployments → Redeploy latest on feat/payment-workorder.

4. STRIPE — directory paid-subscription test (#3):
   On https://directory.roadservice.app → claim a listing → /advertise → start a paid plan →
   complete Stripe Checkout (test card 4242 4242 4242 4242 in test mode, or a real card live).
   Then tell the Claude Code session "verify the directory subscription landed" and I'll confirm via SQL:
     select * from dir_subscriptions order by created_at desc limit 1;
     select tier,status from dir_placements where listing_id='<listing>';
   If the tier doesn't upgrade from 'free', the gap is the Stripe webhook handler (app code).

=====================================================================
C) spatial_ref_sys (#1)  — accept or ticket
=====================================================================
The table is owned by the PostGIS superuser; RLS can't be enabled by normal roles. Either accept it
(public SRID reference data — no sensitive rows) or file a Supabase support ticket to enable RLS / move
PostGIS to an `extensions` schema.

=====================================================================
D) Go-live cutover (#9 + Stripe live)  — last
=====================================================================
- Back up, then run rigdispatch-audit/migrations/09_seed_purge.sql (scoped to test ids).
- Switch Stripe to live keys across all apps; confirm production domains; final smoke test
  (customer request→dispatch→pay; mechanic onboarding; directory claim + paid upgrade).
- Ask the Claude Code session to re-run get_advisors(security)+(performance) for a clean final check.

When the deploys/env/Stripe are done, come back to a Claude Code session scoped to `rigdispatch`
and say "continue the RigDispatch go-live from PR #3" — I'll verify everything end-to-end and run the
final advisor pass.
