# RoadService — Master Launch Harness execution record

**Date:** 2026-08-18 · executes the "Master Launch Harness, Revision 2026-08-18" directive
**Session scope:** this audit repo (`SHA-256-...`), the Base44 MCP, the Vercel/Supabase/Stripe MCPs,
and public-web reads via Exa. The `albertsroadservice/rigdispatch` repo could **not** be attached
(cross-owner add rejected) — everything that needs that repo is written up as a turn-key hand-off in
§6.

Raw structured audit evidence (5 parallel auditors, 102 tool calls):
`evidence/launch-audit-2026-08-18.json`.

---

## 1. What this session changed (all changes verified green)

### Base44 launch app `6a8076afba92840995f8e8ec` ("Truck Road Service" / Business Hub)

1. **Fixed the red release gate.** `npm run verify:release` was failing:
   `scripts/verify-private-surface.mjs` still asserted `/repairs` and `/repairs/ticket-123` "must
   stay reachable" — stale assertions from before the scope correction (the same class of problem
   harness §9.1 flags for `truthful-public-copy.test.ts` in the directory zone). Retargeted: both
   paths moved to the "must leave the private surface" list.
2. **Added a scope guard.** New `scripts/verify-scope-guard.mjs` (run as `test:scope-guard`, wired
   into `verify:release`) asserts: no `/repairs` routes; the five retired functions
   (`createTicket`, `addTicketUpdate`, `createFleet`, `joinFleet`, `verifyFleetCode`) keep
   returning **410 Gone** and never write; no frontend file imports a retired function; no
   coordinated-roadside promise ("repair ticket", "fleet code", "breakdown request", "mechanic
   bid", "dispatch network", "job fee", "escrow") reappears anywhere in `src/`; onboarding stays
   fleet-free; tier prices stay **$38 / $78 / $138**; `RepairTicket`/`TicketUpdate` entities stay
   preserved.
3. **Closed harness §9.2 ("no automated test suite").** That item was already half-stale — the app
   has four node-based verification scripts. Added the canonical `npm test` script (alias of
   `verify:release`), so the Milestone 5 "automated regression tests" gate now has a standard entry
   point. Full gate run is green: **`npm test` (4 suites), `npm run lint`, `npm run typecheck`,
   `npm run build` all pass.**
4. **Rollback anchors.** Checkpoint `6a8479de` (commit `730cf5e`) before changes; checkpoint
   `6a847ad3` (commit `c20c355`) after, with everything green.

### Base44 app disambiguation (harness §9.3)

Rename requests were submitted through the Base44 builder for both confusable apps
(identities verified by inspection first — `6a70c7a9c6278c09de614dc0` has the 45-entity dispatch
marketplace schema incl. `BreakdownRequest`/`ProviderOffer`/`Assignment`; `6a70c4524dd58859908b33e0`
is empty Vite boilerplate):

- `6a70c7a9c6278c09de614dc0` → "ARCHIVED do not edit — old dispatch marketplace capture"
- `6a70c4524dd58859908b33e0` → "ARCHIVED do not edit — empty boilerplate"

The builder accepted both requests but the app-list names had not refreshed by end of session.
**Verify the names in the Base44 dashboard; if unchanged, rename manually in each app's settings.**
As a deterministic guard that does not depend on the rename, both archived apps' `CLAUDE.md` and
`AGENTS.md` now open with "⛔ ARCHIVED — WRONG APP, DO NOT EDIT" and point to the launch app, so
any future agent session lands on the warning before touching code.
The launch app is, and remains, **`6a8076afba92840995f8e8ec` only**.

### This repo

- Superseded banners added to the four 2026-06-03 documents (they predate the scope correction and
  their "GO" / runbook steps would deploy the dispatch marketplace — do not execute them).
- `PHONE_NUMBER_CHANGE.md` status updated: the (561) 726-3111 number is **live in production**
  (observed on /how-it-works, /terms, and app.roadservice.app on 2026-08-18).

---

## 2. Verification of harness §8 "Done" claims

**Base44 app — CONFIRMED DONE.** All 12 claims verified against code with file:line evidence
(see `evidence/launch-audit-2026-08-18.json`, `base44.checks`). Highlights: routes/nav/profile/
onboarding/legal clean; five 410 stubs in place; entities preserved; public-listing projection uses
an exact-key contract that **excludes every private field checked** (no owner email, Stripe IDs,
claim tokens, admin notes, memberships; address/coordinates only when public-address-eligible,
otherwise 0.1°-rounded centroid). The only stale claim was "no test suite" (§1 above).

**Apex marketing zone — NOT LIVE.** Harness §8 says the cleanup exists on unpushed branch
`chore/remove-coordinated-roadside-scope` (`2d583b3`). Production disagrees with §8's "Done" heading
in every observable way (§3). ⚠️ **That branch exists only in some prior session's local checkout.
Remote-session containers are ephemeral — if it was never pushed, the work may already be lost and
must be re-applied per §8's description.** First action for the rigdispatch session: check whether
the branch exists anywhere; push it if found.

---

## 3. Live public-surface audit (production, 2026-08-18)

### 3.1 Apex zone — 11 of 12 pages still sell coordinated dispatch (Milestone 1 blocker)

Every page slated for removal is live and rendering full dispatch marketing: `/how-it-works`
("Mechanics compete with bids"), `/for-drivers`, `/for-fleets` ("command center", job fee,
escrow), `/for-mechanics` (bid/job-fee mechanics recruiting), `/status` (request→bid→approve flow),
`/contact`, `/join` ("Apply to join the dispatch network"). The homepage headline is "Find truck
service. Request roadside help." `/about` literally self-describes RoadService as **"a dispatch
broker"**. Only `/waitlist` is essentially clean.

**Legal pages are the sharpest risk:** `/terms` and `/privacy` (both effective 2026-07-13) codify
the dispatch-broker contract — bids, the job fee ("exact difference between the customer-approved
total and the accepted mechanic bid"), on-site collection, RoadService-managed payment/escrow,
weekly mechanic invoicing, 7-year job-record retention. The public contract contradicts what the
product now is.

### 3.2 Directory zone — dirty in nearly every template family (Milestone 1 blocker)

All three known production phrases confirmed verbatim on live pages. Per-template verdicts
(sampled via sitemap discovery, 20+ URLs):

| Template | Verdict | Worst finding |
|---|---|---|
| `/directory` | DIRTY | "Listing coverage does not guarantee dispatch availability"; "submit a roadside request for availability-based dispatch" |
| `/locations` (state index) | CLEAN | — |
| State pages | DIRTY | "Directory coverage does not guarantee dispatch availability." |
| City pages | DIRTY | **Every provider card carries a "Request service" deep link into app.roadservice.app** with shop/lat/lng params — a breakdown-request funnel on each listing |
| Service-in-city | DIRTY | "customer-facing all-in total shown before assignment" |
| `/shop/*` profiles | DIRTY | dispatch-eligibility disclaimer + "Apply to the dispatch network" CTA |
| Guides + hub | DIRTY | "One request. Availability-based matching."; "including any applicable job fee, before assignment" |
| Cost guides + hub | DIRTY | "including the RoadService job fee when applicable"; "A mechanic's bid is not necessarily the customer price"; "Get dispatched now" |
| Compare (9 pages) | DIRTY | "RoadService.app is an on-demand dispatch marketplace" |
| Trailer-type (16 pages) | DIRTY | "Dry Van Trailer down? Submit a roadside request." |
| National hubs | MIXED | `/mobile-truck-repair` clean; `/truck-breakdown-service`, `/truck-roadside-assistance` are dispatch funnels |
| `/join` (in directory sitemap) | DIRTY | full dispatch-network application form |
| `/advertise` | mostly OK | sponsored placement clearly labeled — but see pricing conflict below |

Not sampled: the `/repair/*` and `/diagnose/*` fault-code families (~500 pages) — the guides hub
frames them with the same "submit a roadside request" CTA; spot-check during cleanup.

**Sponsored labeling (a "Definition of complete" item): PASS as observed** — the only sponsored
slot seen was explicitly labeled, and no unlabeled sponsored listing was found.

**💰 Pricing conflict (new finding):** the live `/advertise` page sells **Free / Basic $29 /
Priority $79 / #1 Spot $199**, while the harness revenue model and the Business Hub
(`src/lib/tiers.js`, Stripe) say **$38 / $78 / $138**. Two different public price sheets for the
same product. Decide which is canonical and align the directory zone (likely alongside the copy
cleanup, since `/advertise` is a directory-zone page).

### 3.3 Host hygiene — "one canonical public domain" does not hold

| Host | Observed | Verdict |
|---|---|---|
| `business.roadservice.app` | Business Hub shell (client-side app) | ✅ in scope |
| `handsome-fleet-fix-flow.base44.app` | Error shell titled "RoadService Business Hub"; **not** a competing directory. `sitemap.xml` 410 could not be confirmed (tooling can't read non-HTML status codes) | ~ acceptable; verify 410 with `curl -sI` from an egress-capable machine |
| `app.roadservice.app` | **LIVE, publicly advertising breakdown-request intake** ("Roadside request intake for trucks", SOS flow, "Call roadside request support · (561) 726-3111") | ❌ contradicts directory-only launch |
| `api.roadservice.app` | **Public HTML index documenting the marketplace API** ("POST /v1/requests — create a roadside request", "POST /v1/offers — submit a bid", dispatcher markup/approve endpoints) | ❌ publicly documents the dispatch mechanics |
| `mechanic.roadservice.app` | "Redirecting to sign in…" (gated, low exposure) | ⚠️ live but quiet |
| `dispatch.roadservice.app` | "Verifying Dispatch access…" (gated) | ⚠️ live but quiet |
| `directory.roadservice.app` | **Serves a full duplicate of the public directory** on its own hostname, incl. "Listing coverage does not guarantee dispatch availability" | ❌ duplicate-content SEO risk unless it 301s/canonicals to the apex (headers unverifiable from here) |
| `www.roadservice.app` | Same content as apex; redirect-vs-mirror indistinguishable from here | verify 301 with curl |

The harness says the out-of-scope portals are "not deleted — simply no longer advertised from the
apex". Reality: **the apex still links into them** (every city-page listing card, the homepage
CTAs), `app.` markets request intake to anonymous visitors, and `api.` documents bids and markup
publicly. Minimum for launch: stop linking to them from public pages, and put `app.`/`api.` behind
auth or a holding page (their four Vercel domain attachments are listed in §4).

### 3.4 Support phone

The (561) 726-3111 rollout **has shipped** on the surfaces observed (apex /how-it-works and /terms,
app.roadservice.app). `PHONE_NUMBER_CHANGE.md` is updated accordingly.

---

## 4. Vercel account audit (harness §9.5) — 36 projects, one team

Team `albertsroadservices-projects` (`team_2BstI1BjhxBYRswaG6TtOLT2`) is the only team.
Full per-project classification is in the evidence JSON. Summary:

- **Release cohort (2):** `rigdispatch-marketing` (prod deploy READY 2026-08-18),
  `rigdispatch-directory` (⚠️ latest 2026-08-18 deploy is a **preview** — no production deployment
  visible).
- **Out-of-scope dispatch apps (7):** `rigdispatch-driver`, `-mechanic`, `-dispatcher`, `-api`,
  `-home`, `-dispatcher-agent`, plus `roadservice-staging` (dormant).
- **Strays / gates (6):** `rigdispatch-platform-verification` (created today, empty),
  `rigdispatch-directory-gate-j-rehearsal`, `rigdispatch-directory-gate-h-486cc0b`, and bare-named
  error-state duplicates **`directory`**, **`api`**, (+`server`, `admin` from the TruckMedic era) —
  a `vercel link`/deploy from the wrong cwd lands in these silently. Recommend deleting or renaming.
- **Unrelated ventures (~20):** truckmedic suite, tradeos/crewcommander, quotedrop, storymint,
  shopbid, alberts-road-service (company site), etc. Remove from all launch procedures.

**Domain findings (both need action before cutover):**

1. **No roadservice.app-family domain is attached to any project in this account for the in-scope
   zones.** `roadservice.app`, `www`, `directory.roadservice.app` are not on
   `rigdispatch-marketing`/`-directory` (they hold only *.vercel.app domains) — yet production
   serves their content. Either the domains live in another Vercel account/team this token can't
   see, or a proxy/DNS layer fronts the deployments. **"The exact tested build is the exact
   deployed build" cannot be certified until someone runs `vercel domains ls` / checks DNS from an
   authorized environment.** (`business.roadservice.app` on Base44 is expected and fine.)
2. **Four family subdomains ARE attached — all to out-of-scope dispatch projects:**
   `app.roadservice.app` → `rigdispatch-driver`, `api.` → `rigdispatch-api`,
   `dispatch.` → `rigdispatch-dispatcher`, `mechanic.` → `rigdispatch-mechanic`.

---

## 5. Harness §9 open items — status after this session

| # | Item | Status |
|---|---|---|
| 1 | Directory zone still sells dispatch | **Confirmed live in production**, template-by-template map in §3.2 + evidence JSON. Needs the rigdispatch repo (§6). |
| 2 | Base44 app has no automated test suite | **CLOSED.** `npm test` → `verify:release` (4 suites incl. new scope guard); all green. |
| 3 | Two confusable "RoadService.app" Base44 apps | **Rename requests submitted**; confirm they landed, else rename manually (§1). |
| 4 | "Authorized Vendor" net-30 program | Audited: it is direct-pay badge signaling, no coordination flow — compatible with directory scope. The business decision (launch it or not / is net-30 real today) remains with Albert. |
| 5 | Vercel sprawl | **Mapped** (§4). Cohort = `rigdispatch-marketing` + `rigdispatch-directory`. Deletion/rename list provided; nothing deleted (destructive — owner's call). |
| 6 | rigdispatch checkout housekeeping (`git gc`, `_to_delete/`) | Untouched — needs the machine that has that checkout. |

---

## 6. Hand-off runbook — the launch-blocking work (needs `albertsroadservice/rigdispatch`)

Start a session scoped to `albertsroadservice/rigdispatch` (this session's GitHub scope could not
add it) and do, in order:

1. **Rescue or re-do the apex cleanup.** Look for branch `chore/remove-coordinated-roadside-scope`
   (`2d583b3`). If it exists: run `npm install && npm run build && npm run lint` + the e2e suite
   (harness §8 flags these as not yet run), then merge and deploy `rigdispatch-marketing` to
   production. If the branch is gone, re-apply per harness §8's description (routes to 301, nav/CTA
   removals, about/contact/terms/privacy rewrite, /api/waitlist 410, guard test).
2. **Rewrite the apex Terms & Privacy first among equals** — they are the standing public contract
   for a business model that no longer exists (§3.1).
3. **Directory zone cleanup (harness §9.1).** Hot spots confirmed live: `lib/compare.ts`,
   `lib/cityServiceContent.ts`, `lib/costguides.ts`, `lib/guides.ts`, `lib/trailers.ts`,
   `lib/nationalServiceHubs.ts`, `components/JoinDispatchCTA.tsx`, `app/join/page.tsx`,
   `app/api/join/route.ts`, `app/about/page.tsx`, `app/page.tsx`, plus: the per-listing
   "Request service" deep links on city pages, the shared footer request-CTA block, and the
   `/repair/*` + `/diagnose/*` framing. Retarget `tests/unit/truthful-public-copy.test.ts`
   alongside. Remove `/join` and `/truck-breakdown-service` from the directory sitemap.
4. **Resolve the price-sheet conflict** on `/advertise` ($29/$79/$199 vs $38/$78/$138) — §3.2.
5. **Deploy `rigdispatch-directory` to production** (its latest deploy is a preview) and confirm
   which infrastructure actually serves `roadservice.app`/`www`/`directory.` (§4 finding 1);
   make `www` and `directory.` 301/canonical to the apex.
6. **Quiet the out-of-scope hosts:** remove public marketing from `app.roadservice.app`, remove or
   gate the public API index on `api.roadservice.app`; stop linking to them from any public page.
7. **Housekeeping:** `git gc --prune=now`, remove `_to_delete/` (§5.6); Vercel stray-project
   cleanup per §4 (owner approval).

Independent of the repo, from any egress-capable terminal:
`curl -sI https://handsome-fleet-fix-flow.base44.app/sitemap.xml` (expect 410) and
`curl -sI https://www.roadservice.app/` (expect 301 → apex).

---

## 7. Milestone stoplight after this session

| Milestone | State |
|---|---|
| M1 Public directory | 🔴 blocked on §6.1–6.6 (live surface still sells dispatch; directory-zone prod deploy unverified) |
| M2 Business Hub | 🟢 code verified clean + gates green (live E2E click-through still to run) |
| M3 Security & admin | 🟢 code-level invariants verified (projection contract, suspension, final-owner, claim/trust separation — see evidence); live pen-check still to run |
| M4 Sponsored placement | 🟡 hub side green ($38/$78/$138, Top Spot exclusivity); public side blocked by the §3.2 pricing conflict + directory deploy |
| M5 Production release | 🔴 blocked on M1 + domain-serving verification (§4) |
