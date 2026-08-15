# App Build Analysis: Find Truck Service (iOS, App Store id 1027671788)

**Build analyzed:** v7.0.6 (released July 20, 2026) — https://apps.apple.com/app/id1027671788
**Analysis date:** August 15, 2026
**Method:** Multi-agent research sweep across the App Store listing and iTunes Lookup API, Wayback Machine captures (2016–2026), Google Play, third-party app trackers (AppBrain, MWM, FoxData, soft112/apps112 changelog mirrors), findtruckservice.com and its advertiser terms, trade press, driver forums, and measured Semrush SEO data.

---

## Executive summary

**Find Truck Service** is a free truck-breakdown/repair directory app by Find Truck Service, Inc (Illinois; founded 2007). The current build, v7.0.6, is a substantial July 2026 re-investment: app size jumped 54% (49.8 → 76.8 MB), the minimum OS jumped from iOS 15.1 to 16.4, and the entire App Store listing was renamed and rewritten the same day.

The headline findings:

1. **The iOS app is a small storefront on top of a very large web platform.** The app has only 77 lifetime iOS ratings (≈1 new rating/year) and an estimated 50K+ lifetime iOS installs — tiny. But measured Semrush data shows **findtruckservice.com is the largest organic-search property in the truck-breakdown directory space by a wide margin**: ~113K estimated monthly organic visits, ranking **#1 in the US for "truck repair near me" (18,100 searches/mo), "truck repair," "semi truck repair near me," and "truck service near me"** — roughly 17× truckdown.com's organic traffic and 15× nttsbreakdown.com's.

2. **The app was dormant for ~8 years and has been genuinely revived.** iOS sat on v1.3 from September 2015 until July 2023, then got a full rewrite (v7.0.2, March 2024) and steady patches since. v7.0.6's release notes map directly onto real user complaints (map clutter/flicker, registration friction, mile markers), which the developer publicly acknowledged and fixed — a responsive, if slow (~2 releases/year), maintenance cadence.

3. **The company is tiny.** ~3 employees (US + Bosnia and Herzegovina), family-run (founder/CEO Amer Avdic, a former diesel mechanic), never funded. The big reach claims (30,000+ locations, 3M+ annual searches) are self-reported, but the traffic measurement above makes them plausible.

4. **For a roadside-service vendor, the economics are now fully documented** (confirmed on FTS's own site, not just competitor claims): annual ad tiers of **$138 / $258 / $378 / $498**, a **free listing option**, no auto-renew clause, and free syndication of approved listings into DAT One's mobile map. Reputation checks found essentially no complaint record against the company — but note the near-identical lookalike domain `findtrucksservice.com` (extra "s"), a different and sketchy operation that should not be confused with this one.

---

## 1. Build metadata (v7.0.6)

Pulled from the iTunes Lookup API and the live App Store page (fetched 2026-08-15):

| Field | Value |
|---|---|
| App name / subtitle | Find Truck Service / "Truck Repair & Roadside" |
| Bundle ID | `com.Find-Truck-Service` |
| Version / released | **7.0.6** / **2026-07-20** (UTC) |
| Original App Store release | 2015-09-01 (as "Find Truck Service & Stops") |
| Size | 76,805,120 bytes (76.8 MB) — up from 49.8 MB in v7.0.5 |
| Minimum OS | iOS/iPadOS **16.4** — up from 15.1 in v7.0.5 |
| Devices | iPhone, iPad (universal); runs on Apple Silicon Macs (macOS 12+, compatibility mode, "Not verified for macOS") and Apple Vision (visionOS 1.0+) |
| Price / IAP | Free; no In-App Purchases row on the listing (inference — the API doesn't report IAP status); no ads |
| Category | Navigation (primary), Travel (secondary, API-only) |
| Rating | **4.8** displayed (4.75325 exact) from **77 ratings** |
| Age rating | 4+ |
| Languages | English only (available in 168 storefronts) |
| Privacy label | "Data Not Linked to You" only: Location, Search History, Browsing History, Usage Data; no tracking section |
| Accessibility | Not declared ("developer has not yet indicated…") |
| Screenshots | 10 iPhone + 10 iPad (Apple's maximum); no preview video found |
| Seller | Find Truck Service, Inc; sellerUrl points to findtruckservice.com/advertise |
| VPP | Volume Purchase Program device-based licensing enabled |

**v7.0.6 release notes** (verbatim themes): fixed map flicker, improved search, fixes for truck IDs/deletions/repair tickets, ratings/notes/repair updates now instant, new in-app feedback option, faster loads, splash-screen fix.

**Technical read on this build:** the 54% size jump, the min-OS jump of more than a full major version (15.1 → 16.4), and a same-day rename/rewrite of the store listing together indicate a meaningful rebuild and a deliberate relaunch push, not a routine patch.

## 2. Version history — the 8-year dormancy and the revival

Timeline reconstructed from Wayback Machine captures of the App Store page and App Store changelog mirrors (soft112/apps112, applion, FoxData):

| Version | Date | Notes |
|---|---|---|
| 1.3 | Sep 1, 2015 | Launch-era build as "Find Truck Service & Stops." **Still the live version in a Sep 20, 2022 Wayback capture** — ~7 years 10 months with zero developer updates |
| 1.4 | Jul 7, 2023 | First real update since 2015: iOS 16 fixes, UI fixes, new icon/splash |
| 7.0.2 | Mar 2, 2024 | Full rewrite/relaunch: new UI/UX, free accounts, Ratings, Rates, backup & sync. Version number jumped from 1.4 to 7.0.2 to unify with Android (which was on 6.x); renamed "Find Truck Service® \| Trucker" |
| 7.0.3 | May 17, 2024 | Interstate/mile markers, private locations, "Show My Vendors" filter, de-clustered map — direct responses to revamp complaints |
| 7.0.4 | May 7, 2025 | Maintenance (mirrors show notes reused from 7.0.3) |
| 7.0.5 | Sep 9, 2025 | Maintenance ("improvements to keep things running smoothly") |
| **7.0.6** | **Jul 20, 2026** | Current build (see above) + full listing overhaul: renamed to "Find Truck Service," new subtitle, fully rewritten description |

**Cadence:** dormant 2015–2023, then ~2 releases/year since the 2024 relaunch. The Android sibling (`org.fts.findtruckservice`, on Google Play since June 2012) kept receiving 6.x maintenance during the iOS dormancy and now tracks iOS releases within days (Android 7.0.6 shipped Jul 10–21, 2026 depending on tracker).

## 3. Ratings and review sentiment

- **iOS: 4.8★ from 77 ratings — excellent average, statistically thin.** Rating velocity is ~1–2 new ratings/year (75 in Jul 2024 → 76 in Feb 2026 → 77 in Aug 2026). No ratings reset occurred; the average is dominated by 2015-era launch reviews, and Apple's "most helpful" reviews are still three from Sep–Oct 2015. There is no evidence of an in-app review-prompt strategy.
- **Android is the better sentiment mirror: 4.3★ from ~1,000 ratings** (histogram ≈ 710×5★ / 87×4★ / 57×3★ / 9×2★ / 110×1★).
- **Praise themes:** breakdown vendor lookup that works ("it's gotten me who I've needed for the job"), proximity results, simplicity, mom-and-pop coverage, and (in 2015-era reviews) diesel-price comparison — note the fuel-price feature praise predates the 7.x rewrite and may describe a defunct feature set.
- **Complaint themes:** forced registration/personal info at login (Android 2★, Mar 2024, developer replied same day promising to "minimize the info we ask"); map regressions in the 7.x revamp (clutter, missing mile markers — later fixed in 7.0.3/7.0.6); one iOS review alleging spam calls after providing a mobile number (single, uncorroborated — see §6); location permission required for the app to function.
- The developer visibly acts on feedback: every major complaint theme maps to a subsequent release-note fix, and 7.0.6 added an in-app feedback channel.

## 4. The company behind the build

- **Find Truck Service, Inc** — founded 2007 (relaunched 2010), privately held, never funded (Tracxn). Founder/CEO **Amer Avdic**, a former diesel mechanic who ran his own Chicago roadside-service business; his brother Faruk is also involved.
- **~3 employees**, workforce split between the US and Bosnia and Herzegovina. Offices historically in Schaumburg, IL; the current contact page lists 2020 Calamos Ct Suite 200, Naperville, IL. Sales: (847) 586-9110; support: (888) 586-4788.
- Live USPTO trademark "FIND TRUCK SERVICE" (reg. 4382473, 2013). Treated as a legitimate mainstream locator by trade press (Fleet Maintenance, Oct 2025, names the space's leaders as "TruckDown, Trucker Path, and Find Truck Service").
- Self-reported claims: 30,000+ phone-verified locations (re-verified 2×/year), 150,000+ app downloads, 3M+ annual searches. The download claim is consistent with third-party estimates (~140K Android + 50K+ iOS).

## 5. Measured platform reach — the real story

Semrush measurements (US database, pulled 2026-08-15) reframe what this app is: the **website**, not the app, is the audience.

| Domain | Est. monthly organic visits | Organic keywords | Authority Score |
|---|---|---|---|
| **findtruckservice.com** | **112,862** | 135,130 | 33 |
| truckerpath.com | 91,306 | 20,115 | 43 |
| 4roadservice.com | 10,337 | 22,256 | 27 |
| nttsbreakdown.com | 7,449 | 258 | 29 |
| truckdown.com | 6,596 | 10,149 | 28 |
| breakdowninc.com | nothing found in any Semrush DB | — | — |

- findtruckservice.com is **#1 in the US** for "truck repair near me" (18,100/mo), "truck repair" (14,800), "semi truck repair near me" (9,900), "truck repair shop" (6,600), "truck service near me" (5,400); #2 for "mobile truck repair near me" and "truck road service near me."
- Organic traffic roughly **doubled in 24 months** (~58K/mo mid-2024 → 117–122K/mo mid-2026), with breakdown-seasonal summer peaks. Zero paid search — it's all organic.
- Trucker Path's larger overall traffic is truck-stop/parking/fuel intent; it does not appear in the repair-intent top rankings at all. Among breakdown directories, FTS owns the high-intent repair queries outright.
- App reach for context: FTS Android ~140K lifetime installs (AppBrain; ~200/month currently) vs Trucker Path's 5M+, but vs TruckDown's 10K+, 4RoadService's 5K+, and Breakdown Inc's 1K+.

## 6. Vendor-side economics and reputation (relevant to service providers)

**Advertising pricing — confirmed on FTS's own /vendor page** (JS-rendered section; corroborated by a June 2024 Wayback capture and a 2021 Tracxn profile; prices unchanged since at least 2021):

| Tier | Price | Contents |
|---|---|---|
| Basic | $138/yr | Name, address, 1 phone; no image, no description |
| Basic Plus | $258/yr | Image + 3-line description |
| Standard | $378/yr | Image + 6-line description + website link |
| Premium ("Most Popular") | $498/yr | Image + 12-line description + website link, top placement |
| **Free listing** | $0 | "Create Free Listing" option exists alongside paid tiers; listings require FTS approval and phone verification |

- Sales is phone-driven — no online checkout; outbound reps call vendors. FTS claims "minimum ROI well over 10× the cost" with call/view tracking analytics (self-reported, unverifiable).
- **Advertiser Terms** (last updated Feb 2023): annual subscription; vendor may cancel anytime but refunds only "as expressly provided," pro-rated by whole months when granted; FTS may terminate for cause (at its sole discretion) with no refund, or without cause with a refund of the remainder; **no auto-renewal clause** — renewal is an active phone-driven opt-in; Illinois law, DuPage County jurisdiction.
- **Bonus reach:** DAT One imports approved FTS listings into its mobile map weekly (per DAT's own help center) — a free syndication channel.
- Separate **Synchrony co-branded financing program**: free for vendors to join; vendor pays a 2.39% transaction fee on 6-month no-interest purchases ($199+) or 5.79% for optional 12-month financing ($750+); funded in 24–48h, no recourse.
- **Reputation:** essentially clean. No BBB complaints found (profile exists under "Truck Service Inc," not rated); zero reviews on Sitejabber/PissedConsumer; no litigation or enforcement found 2020–2026. The negatives on record: one uncorroborated mid-2010s forum post calling FTS "a scam… funneling calls away from single-location advertisers," one 2016 Google review alleging pay-for-placement pressure, and one app review alleging overseas spam calls after registration (also uncorroborated; FMCSA's own public carrier database is a well-documented alternative source of trucker spam calls).
- ⚠️ **Do not confuse with `findtrucksservice.com`** (extra "s"): a different operation ("Truck Repair Directory LLC," 52-site network, monthly auto-renew billing, "ALL PAYMENTS ARE FINAL AND NON-REFUNDABLE," scam reports attached to its dispatch number). All complaint records found there belong to the lookalike, not to Find Truck Service, Inc.

## 7. Competitive position

| iOS app | Rating / count | State |
|---|---|---|
| **Find Truck Service** | 4.8 / 77 | v7.0.6, Jul 2026 — freshest dedicated-directory app |
| Trucker Path | 4.8 / ~134–149K | Category giant, but navigation/fuel/parking-first; repair discovery secondary |
| TruckDown Search | 4.8 / 510 | iOS build stale (v2.0.188, 2023-era); its modernization (Service Requests, ~40K providers) shipped Android/web-first |
| NTTS Breakdown | — | **No iOS app**; web/print only; strong veteran word-of-mouth |
| FleetNet Mobile (Cox) | 3.8 / 10 | B2B managed-breakdown accounts, not public search |
| Breakdown Inc / 4RoadService | 5.0 / 4 and 4.3 / 6 | Negligible traction |
| Truckup (driver app) | — | "Coming in 2026" — future marketplace threat |

**Pecking order:** trade press consistently names TruckDown + Find Truck Service as the top two dedicated breakdown directories. TruckDown has ~6.6× FTS's iOS rating count and a bigger claimed database (~40K vs 30K), but FTS has the only modern, actively updated iOS app in the niche — and, per §5, a dominant organic-search funnel that none of the app-store numbers hint at.

## 8. ASO assessment of the current listing

The July 2026 listing is a ~1-month-old full overhaul (title, subtitle, and description all replaced), so it has no performance track record yet.

**Strengths:** high-intent subtitle ("Truck Repair & Roadside"); well-structured conversion-oriented description (urgency framing, service taxonomy, OEM brand coverage, audience segmentation, fleet cross-sell); 4.8★; free with no IAP/ads; clean privacy label; full 10-screenshot sets for iPhone and iPad; restored update cadence with human release notes.

**Weaknesses:** 77 ratings after 11 years = weak social proof and ranking signal, with no evident review-prompt loop; not charting in Navigation (outside top 30); high-value keywords absent from indexed metadata (towing, trucker, truck stop, semi, tire, "assistance") and "Truck" duplicated across title+subtitle; the rename dropped "Trucker" from the title (owned mid-volume keyword, unless it lives in the hidden keyword field); English-only metadata across 168 storefronts (no Spanish — an obvious gap for the US driver population); accessibility label unfilled; no preview video found; Android's 4.3★ with registration/location complaints undercuts the pristine iOS 4.8 for anyone who cross-checks.

## 9. Data-quality notes and unresolved discrepancies

- Apple review-level data (per-review stars/dates/versions) was unreachable (reviews RSS feed blocked/rejected in this environment); iOS review analysis relies on page captures and third-party mirrors.
- The iOS/Play privacy declarations contradict each other: iOS declares Location/Search/Browsing/Usage collection (not linked); Google Play claims "No data collected." At least one label is wrong.
- Android 7.0.2's date (APKPure: May 13, 2024) conflicts with a Mar 24, 2024 Play review already complaining about the 7.x redesign — the Android revamp likely shipped ~March 2024, with APKPure showing a first-seen artifact.
- Trucker Path's iOS rating count appeared as ~134K and ~149K on different trackers in the same week; treat as ~134–149K.
- Third-party install estimates (AppBrain 140K Android, MWM "50k+" iOS, Bumetric's synthetic 45K MAU) are estimates of varying quality, not measurements; Semrush organic-traffic figures are modeled from keyword positions, not analytics.
- "No IAP" is inferred from the absence of an IAP section on the rendered listing; the lookup API does not report IAP status.

## 10. Bottom line

As an **app build**, v7.0.6 is a competent, genuinely maintained revival of a long-dormant product: modern OS floor, real bug fixes tied to real complaints, and a fresh listing — but with a tiny iOS install base and no ratings engine, it punches far below the platform's actual reach. As a **platform**, Find Truck Service is the organic-search leader of the truck-breakdown directory niche by a wide, measured margin, run by a ~3-person company with a clean complaint record, transparent-enough annual ad pricing ($138–$498), a free-listing path, and free DAT One syndication. For a roadside-service vendor deciding whether the platform is worth listing on, the measured web traffic — not the 77-rating app — is the number that matters.
