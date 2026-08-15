/**
 * Read model for the directory. Screens/hooks never touch `apiClient` or the
 * SQLite cache directly — they go through this repository, which validates every
 * payload against the Zod schemas and implements the offline-first read policy:
 * a successful search is mirrored into the local cache, and a failed one falls
 * back to that cache so a driver with no signal still sees the last known shops.
 */
import { z } from 'zod';
import { apiGet, pageSchema } from '@services/apiClient';
import { endpoints } from '@config/endpoints';
import { db } from '@/data/db';
import { VendorSchema, CategorySchema } from '@models/index';
import type { Vendor, VendorQuery, Category } from '@models/index';

const CategoryListSchema = z.array(CategorySchema);

/** Flatten a VendorQuery into the query-string params the search Lambda expects. */
function toParams(query: VendorQuery): Record<string, unknown> {
  return {
    lat: query.latitude,
    lng: query.longitude,
    radius: query.radiusMiles,
    serviceTypes: query.serviceTypes?.length ? query.serviceTypes.join(',') : undefined,
    amenities: query.amenities?.length ? query.amenities.join(',') : undefined,
    onlyMine: query.onlyMyVendors ? 1 : undefined,
    cursor: query.cursor,
  };
}

export const vendorRepository = {
  async search(query: VendorQuery): Promise<{ items: Vendor[]; nextCursor: string | null }> {
    try {
      const page = await apiGet(endpoints.vendorSearch, pageSchema(VendorSchema), toParams(query));
      // Warm the offline cache so the same shops are available without signal later.
      try {
        await db.upsertMany('vendors', page.items);
      } catch {
        // Caching is best-effort; a write failure must not fail the search.
      }
      return page;
    } catch {
      // Offline / backend unreachable: serve the last cached directory instead of erroring out.
      const cached = await db.getCachedVendors();
      return { items: cached, nextCursor: null };
    }
  },

  async getById(id: string): Promise<Vendor> {
    return apiGet(endpoints.vendor(id), VendorSchema);
  },

  async getCategories(): Promise<Category[]> {
    return apiGet(endpoints.categories, CategoryListSchema);
  },
};
