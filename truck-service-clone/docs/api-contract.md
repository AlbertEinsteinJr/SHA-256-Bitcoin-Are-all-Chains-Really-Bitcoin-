# Backend API contract (reference)

The mobile client talks to a **serverless REST backend** (API Gateway → AWS Lambda, the stack
signalled by the reference company's own tooling). Every path below is consumed by
`src/config/endpoints.ts` and validated on the client with the Zod schemas in `src/models/`.
This document is the contract the service layer is written against; there is no live server in
this repo.

Conventions: JSON over HTTPS; `Authorization: Bearer <appJWT>` on authenticated routes; list
endpoints return `{ items: [...], nextCursor: string | null }`; timestamps are ISO-8601 UTC.

## Auth

### `POST /v1/auth/session`
Exchange a Firebase ID token for a first-party session.
```jsonc
// req
{ "idToken": "<firebase id token>" }
// res
{ "user": { "id": "u_1", "email": "a@b.com", "accountType": "driver", "createdAt": "…" },
  "accessToken": "<app jwt, ~15m>", "refreshToken": "<opaque>", "expiresAt": 1739900000 }
```

### `POST /v1/auth/refresh`
`{ "refreshToken": "…" }` → `{ "accessToken", "refreshToken", "expiresAt" }`. Called
transparently by the apiClient 401-retry interceptor.

## Directory (read-mostly, cacheable)

### `GET /v1/categories`
Returns the search taxonomy. Cacheable with `ETag`; the client keeps it in react-query for a day.
```jsonc
[ { "id": "c_repair", "serviceType": "mobile_repair", "label": "Mobile Repair", "icon": "wrench" },
  { "id": "c_stop", "serviceType": "truck_stop", "label": "Truck Stops", "icon": "fuel",
    "amenities": ["parking","showers","scales","service"] } ]
```

### `GET /v1/vendors/search`
The core query. Geo + category, cursor-paged, sorted by (tier desc, distance asc).
```
?latitude=41.87&longitude=-87.62&radiusMiles=50
 &serviceTypes=mobile_repair,tire&amenities=parking&onlyMyVendors=false&cursor=<opaque>
```
```jsonc
{ "items": [ {
    "id": "v_1001", "name": "I-80 Diesel & Tire", "serviceTypes": ["mobile_repair","tire"],
    "tier": "premium", "authorizedVendor": true,
    "coordinate": { "latitude": 41.88, "longitude": -87.63 },
    "address": { "city": "Chicago", "state": "IL", "interstateMarker": "I-80 & Exit 145" },
    "phones": ["+13125550110"], "website": "https://example.com",
    "averageRating": 4.6, "ratingCount": 38, "distanceMiles": 2.4,
    "source": "directory", "lastVerifiedAt": "2026-06-01T00:00:00Z"
  } ],
  "nextCursor": "eyJvIjoyMH0" }
```
Server-side ranking is where the paid-listing tiers matter: `premium > standard > basic_plus >
basic > free` within each distance bucket, and `authorizedVendor` vendors get a placement boost.

### `GET /v1/vendors/{id}`
Full vendor record (adds `hours`, full `description`, `amenities`).

### `GET|POST /v1/vendors/{id}/ratings`
`GET` → paged `Rating[]`. `POST` `{ stars, comment?, photoUrls? }` → the created `Rating`
(client shows it optimistically, so the POST reconciles the temporary local id).

## Account-scoped, syncable collections
All require auth and participate in delta sync (see `/v1/me/sync`).

| Method & path | Purpose |
|---|---|
| `GET \| PUT /v1/me/favorites` | saved vendor ids |
| `GET \| POST \| DELETE /v1/me/locations` | user's **private** vendor locations (map-visible only to their team) |
| `GET \| PUT /v1/me/rates` | private per-vendor rate cards (labor/after-hours/call fee) |
| `GET \| POST /v1/me/repairs` | repair tickets |
| `GET \| PATCH /v1/me/repairs/{id}` | one ticket / status change |
| `POST /v1/me/repairs/{id}/updates` | append a `RepairUpdate` (note, cost delta, status, photos) |

### Repair ticket (shared fleet artifact)
```jsonc
{ "id": "r_77", "fleetId": "f_3", "createdBy": "u_1", "truckId": "t_12", "vendorId": "v_1001",
  "status": "in_progress", "title": "No-start, air leak", "breakdownLocation": "I-65 MM 112 S",
  "totalCost": 480.00,
  "updates": [
    { "id": "ru_1", "authorId": "u_1", "authorName": "Sam", "status": "open",
      "note": "Called vendor, ETA 45m", "createdAt": "2026-07-01T14:02:00Z" },
    { "id": "ru_2", "authorId": "u_9", "authorName": "Dispatch", "status": "in_progress",
      "costDelta": 480, "note": "Tech on site", "createdAt": "2026-07-01T15:10:00Z" } ],
  "createdAt": "2026-07-01T14:00:00Z", "updatedAt": "2026-07-01T15:10:00Z" }
```
Tickets are **append-only event logs** so two fleet members editing at once merge without
clobbering each other; scalar records (rates, favorites) are last-writer-wins.

## Delta sync

### `GET /v1/me/sync?since=<cursor>`
Returns everything in the account that changed since the cursor, plus the next cursor.
```jsonc
{ "cursor": "1739900000", "vendors": [], "repairs": [ … ], "rates": [ … ], "ratings": [ … ] }
```
The client (`src/services/sync.ts`) pushes `pendingSync` local writes first, then pulls this
delta and advances the stored cursor. Triggered on foreground and on connectivity regain
(the WorkManager/background-fetch equivalent).

## Misc

- `POST /v1/media` → presigned S3 upload URL for a photo (rating / repair attachment).
- `POST /v1/feedback` `{ message, appVersion, platform }` → 202. Backs the in-app feedback channel.
