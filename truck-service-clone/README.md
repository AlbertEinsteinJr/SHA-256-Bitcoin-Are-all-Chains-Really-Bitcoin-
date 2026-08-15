# Roadside Directory — reference build (structural clone)

A **clean-room, unbranded structural clone** of a heavy-duty truck-service / roadside-directory
mobile app, reconstructed as an **Expo React Native + TypeScript** project so the build's
architecture can be read and dissected file by file.

> This scaffold reproduces the *structure* (tech stack, module boundaries, navigation graph,
> data flow) inferred from public evidence about a shipping app — **not** its source code,
> assets, branding, or data. Identity is deliberately generic (`com.example.roadsidedirectory`).
> Nothing here is affiliated with or endorsed by any real company.

## Why it looks like this

The reference app ships the *same version number on iOS and Android in lockstep*, and its
Android package links **73 libraries** whose fingerprint is unambiguous: React Native + Yoga +
Hermes, Expo modules, React Navigation, `react-native-maps` over the Google Maps SDK, React
Native Firebase (auth/messaging/analytics), Sentry, Reanimated/Gesture Handler/Lottie, Async
Storage + DataStore + SQLite, WorkManager. That is an **Expo-managed React Native app with a
shared TypeScript codebase** — which is exactly why both stores move together. This scaffold is
built on that finding.

See [`../BUILD_STRUCTURE_DISSECTION.md`](../BUILD_STRUCTURE_DISSECTION.md) for the full
evidence-to-architecture dissection, and [`docs/`](docs/) for the architecture notes, the
backend API contract, and the annotated file tree.

## Layout

```
truck-service-clone/
├── app.config.ts        Expo manifest — one file that generates both native shells
├── package.json         the exact library fingerprint of the real build
├── eas.json             cloud build/submit profiles (dev / preview / production)
├── docs/                ARCHITECTURE.md · api-contract.md · build-structure.txt
└── src/
    ├── App.tsx          provider tree (gesture → safe-area → query → navigation)
    ├── config/          env + endpoint map
    ├── theme/           design tokens + useTheme()
    ├── models/          Zod schemas = types = runtime validators (one source)
    ├── navigation/      Root → (Auth stack | App tabs → nested stacks)
    ├── services/        apiClient, auth, sync, location, analytics, crashReporting, storage
    ├── data/            SQLite offline store + repositories
    ├── store/           Zustand (client state) + react-query (server state)
    ├── hooks/           useAuth, useLocation, useNearbyVendors, useRepairs
    ├── components/       VendorCard, VendorList, CategoryGrid, MapMarker, …
    └── screens/         onboarding · auth · search · map · saved · repairs · account · feedback
```

## Running it (illustrative)

```bash
npm install
cp .env.example .env.local        # fill in Google Maps keys, API base URL
npx expo prebuild                 # generates ios/ and android/ from app.config.ts
npm run ios                       # or: npm run android
```

Firebase config files (`GoogleService-Info.plist`, `google-services.json`) and Google Maps API
keys are required for a real device build; they are intentionally absent here.

## Status

Representative scaffold for architectural study. Screens implement the real data flow but not
every edge case; there is no live backend (`docs/api-contract.md` specifies the contract the
services are written against).
