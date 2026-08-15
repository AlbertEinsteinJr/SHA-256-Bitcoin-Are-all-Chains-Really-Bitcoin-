/**
 * Single source of truth for the REST surface exposed by the serverless backend
 * (API Gateway -> AWS Lambda). Kept as functions so path params are type-checked
 * at the call site. See docs/api-contract.md for the full request/response spec.
 */
export const endpoints = {
  // Auth / session
  session: '/v1/auth/session', // POST: exchange Firebase ID token -> app JWT
  refresh: '/v1/auth/refresh', // POST

  // Directory
  categories: '/v1/categories', // GET (cached, ETag)
  vendorSearch: '/v1/vendors/search', // GET (geo + category, cursor-paged)
  vendor: (id: string) => `/v1/vendors/${id}`, // GET
  vendorRatings: (id: string) => `/v1/vendors/${id}/ratings`, // GET | POST

  // Account-scoped, syncable collections
  favorites: '/v1/me/favorites', // GET | PUT
  privateLocations: '/v1/me/locations', // GET | POST | DELETE
  rates: '/v1/me/rates', // GET | PUT
  repairs: '/v1/me/repairs', // GET | POST
  repair: (id: string) => `/v1/me/repairs/${id}`, // GET | PATCH
  repairUpdates: (id: string) => `/v1/me/repairs/${id}/updates`, // POST

  // Delta sync + misc
  sync: '/v1/me/sync', // GET ?since=<cursor> -> changed records across collections
  feedback: '/v1/feedback', // POST (in-app feedback channel)
  media: '/v1/media', // POST -> presigned S3 upload URL
} as const;
