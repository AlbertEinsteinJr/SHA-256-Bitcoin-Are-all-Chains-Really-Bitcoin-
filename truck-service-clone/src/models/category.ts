import { z } from 'zod';

/**
 * The top-level search taxonomy. Mirrors the vendor categories the real listing
 * advertises: mobile repair, shops, towing, tire, reefer, dealers, truck stops, wash.
 * `serviceType` is the coarse grouping that drives the map pin color + list filter.
 */
export const ServiceTypeSchema = z.enum([
  'mobile_repair',
  'repair_shop',
  'towing',
  'tire',
  'reefer',
  'dealer',
  'truck_stop',
  'truck_wash',
  'parts',
]);
export type ServiceType = z.infer<typeof ServiceTypeSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  serviceType: ServiceTypeSchema,
  label: z.string(),
  /** Name of the vector icon rendered in the category grid + map marker. */
  icon: z.string(),
  /** Filters a truck stop can be narrowed by: parking, showers, scales, service. */
  amenities: z.array(z.string()).optional(),
});
export type Category = z.infer<typeof CategorySchema>;
