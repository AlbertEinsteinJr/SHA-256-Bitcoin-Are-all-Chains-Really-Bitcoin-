# Support phone change — (855) 744-2223 → (561) 726-3111

**Status:** ✅ LIVE IN PRODUCTION as of 2026-08-18 — (561) 726-3111 observed on roadservice.app
/how-it-works and /terms and on app.roadservice.app (see `LAUNCH_HARNESS_EXECUTION_2026-08-18.md`
§3.4). The steps below are kept for reference; verify call routing/forwarding is in place.
**Confirmed:** the support number is NOT in the database. A full scan of every text column in the
Supabase `public` schema found no `+18557442223` in any rigdispatch_*/dir_* table — it is a hardcoded
app constant (`SUPPORT_PHONE`) plus header/footer + marketing `tel:` links in the `rigdispatch` repo.

## Launch cautions
1. **Provision/forward 561-726-3111 to dispatch BEFORE swapping the website** so launch calls don't hit a
   dead line. If the old 855 number is a Twilio line, move the routing first.
2. `SUPPORT_PHONE` is interpolated into the signed `WORK_ORDER_TERMS_V1` template, so changing it changes
   that document's sha256. Harmless while `NEXT_PUBLIC_WORKORDER_FLOW` is OFF; regenerate terms before
   enabling the work-order flow.

## Exact change (run in a clone of albertsroadservice/rigdispatch)
```bash
# locate every occurrence
grep -rn -e '8557442223' -e '855) 744-2223' -e '855-744-2223' -e 'SUPPORT_PHONE' apps packages

# repo-wide replace of tel: links and display strings
grep -rl -e '+18557442223' -e '855) 744-2223' -e '855-744-2223' apps packages \
  | xargs sed -i \
      -e 's/+18557442223/+15617263111/g' \
      -e 's/1 (855) 744-2223/(561) 726-3111/g' \
      -e 's/(855) 744-2223/(561) 726-3111/g' \
      -e 's/855-744-2223/561-726-3111/g'

# set the SUPPORT_PHONE constant (work-order-terms.ts) to +15617263111 / (561) 726-3111
pnpm -w typecheck && pnpm -w test
git checkout -b chore/support-phone-561
git commit -am "chore: support phone -> (561) 726-3111"
git push -u origin chore/support-phone-561
# Vercel auto-deploys previews; promote directory + marketing + home to production when green
```

## Verify after deploy
- directory.roadservice.app header/footer shows (561) 726-3111 and `tel:+15617263111`
- roadservice.app marketing + JSON-LD updated
- (ask the Claude Code session to confirm each app's production deployment is READY via the Vercel MCP)

To have Claude do this end-to-end: start a session scoped to `albertsroadservice/rigdispatch` and say
"change the support phone to 561-726-3111".
