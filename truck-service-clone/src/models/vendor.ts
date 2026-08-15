import { z } from 'zod';
import { CoordinateSchema, AddressSchema } from './location';
import { ServiceTypeSchema } from './category';

/** Paid-listing tier. Drives sort rank, card richness, and "Featured" placement. */
export const ListingTierSchema = z.enum(['free', 'basic', 'basic_plus', 'standard', 'premium']);
export type ListingTier = z.infer<typeof ListingTierSchema>;

export const BusinessHoursSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  open: z.string(), // "07:00"
  close: z.string(), // "23:00"
  is24Hour: z.boolean().default(false),
});
export type BusinessHours = z.infer<typeof BusinessHoursSchema>;

export const VendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  serviceTypes: z.array(ServiceTypeSchema),
  tier: ListingTierSchema,
  /** True for the paid "Authorized Vendor" financing badge shown on the card. */
  authorizedVendor: z.boolean().default(false),
  coordinate: CoordinateSchema,
  address: AddressSchema,
  phones: z.array(z.string()).min(1),
  website: z.string().url().optional(),
  description: z.string().optional(),
  hours: z.array(BusinessHoursSchema).optional(),
  amenities: z.array(z.string()).optional(),
  logoUrl: z.string().url().optional(),
  averageRating: z.number().min(0).max(5).optional(),
  ratingCount: z.number().int().default(0),
  /** Straight-line miles from the search origin — computed server-side per query. */
  distanceMiles: z.number().optional(),
  /** Distinguishes a shared directory listing from a user's private location. */
  source: z.enum(['directory', 'private']).default('directory'),
  lastVerifiedAt: z.string().datetime().optional(),
});
export type Vendor = z.infer<typeof VendorSchema>;

/** A geo + category query. Serialized straight into the /vendors/search request. */
export interface VendorQuery {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  serviceTypes?: string[];
  amenities?: string[];
  onlyMyVendors?: boolean;
  cursor?: string;
}
