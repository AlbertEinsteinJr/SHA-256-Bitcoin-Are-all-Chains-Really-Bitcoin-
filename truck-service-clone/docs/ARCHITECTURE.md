# Architecture notes

How the reference build is put together, and how this scaffold mirrors it.

## One codebase, two stores

The reference app ships the **same version on iOS and Android at the same time**. That lockstep
is the signature of a shared cross-platform codebase, and the Android library fingerprint
(React Native + Yoga + Hermes + Expo modules) identifies it as **Expo-managed React Native**.
In this scaffold, `app.config.ts` is the single manifest `expo prebuild` reads to generate an
Xcode project and a Gradle project from one JS bundle — so a feature is written once and both
binaries move together.

## Layered dependency direction

```
screens ──▶ hooks ──▶ repositories ──▶ services ──▶ (network / native / storage)
   │           │            │              │
   └── components (presentational, theme-only)   store (zustand + react-query)
                    models (types + zod)  ← imported by every layer
```

Rules that keep it honest:
- **Screens never call the network directly.** They call hooks; hooks call repositories;
  repositories call `apiClient` and/or the SQLite `db`.
- **Components are presentational** — they take props and read `useTheme()`, nothing else.
- **Models are the shared contract.** Zod schemas double as TypeScript types *and* runtime
  validators, so a bad payload fails at the API boundary instead of three screens deep.

## State: two kinds, two tools

| Kind | Owns | Tool |
|---|---|---|
| **Server state** | vendor search, vendor detail, categories, repairs list | `@tanstack/react-query` — cache, dedupe, pagination, background refetch |
| **Client state** | session/auth status, active filters, map region | `zustand` — `authStore`, `searchStore` |

Mixing these is the usual RN mess; keeping them separate is the core state decision.

## Offline-first data flow

The reference app advertises that ratings, notes, and repair updates "show up instantly." That
is optimistic local write + background reconcile, implemented here with the SQLite + sync pair:

```
user action ─▶ db write (pending=1) ─▶ UI updates immediately (optimistic)
                                   └─▶ syncService.run()  ─push▶ POST/PUT, clear pending
                                                          ─pull▶ GET /me/sync?since=cursor ─▶ upsert
```

`src/data/db.ts` is the local record store and the outbound queue; `src/services/sync.ts` is the
reconciler. Repair tickets are append-only event logs so concurrent fleet edits merge.

## Navigation graph

```
RootNavigator (native stack)
├── status==='loading'  → null (native splash held while session restores from SecureStore)
├── signedOut → AuthStack     : Onboarding → SignIn → Register
├── signedIn  → AppTabs (bottom tabs)
│   ├── SearchTab  → SearchStack : SearchHome → Results → VendorDetail
│   ├── MapTab     → MapScreen
│   ├── SavedTab   → SavedScreen  (Favorites | Private locations)
│   ├── RepairsTab → RepairsStack : RepairsList → StartRepair(modal) → RepairTicket
│   └── AccountTab → AccountScreen
└── Feedback (modal, available from anywhere)
```
Search is usable signed-out; rating, rates, private locations, and repair tickets require auth.

## Cross-cutting services

- **auth.ts** — Firebase authenticates, then we exchange its ID token for a first-party app JWT
  so backend Lambdas verify our own short-lived token. Session lives in SecureStore.
- **apiClient.ts** — one axios instance: attaches the JWT, refreshes-and-retries once on 401,
  Zod-validates every response.
- **location.ts** — expo-location; seeds the initial map region and every `vendors/search`.
- **analytics.ts / crashReporting.ts** — Firebase Analytics + Sentry, both fail-safe (never throw).
- **storage.ts** — SecureStore for secrets, AsyncStorage for cached JSON, SQLite for records.

## Build & release pipeline

`eas.json` defines dev / preview / production profiles. Production emits an iOS build and an
Android **app bundle**; OTA JS updates ride the EAS Update channel (the "instant fix" path that
skips a full store review). Sentry source maps upload from `metro.config.js` at build time.

## Why the download is large

A universal Android APK bundles every ABI + Hermes + Reanimated/Lottie/maps native code +
JS bundle + assets, which is why the sideload APK dwarfs the thinned, per-device iOS download.
The Play Store delivers a much smaller split from the same app bundle.
