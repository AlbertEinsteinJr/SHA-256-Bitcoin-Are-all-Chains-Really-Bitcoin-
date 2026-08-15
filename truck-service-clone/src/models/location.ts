import { z } from 'zod';

export const CoordinateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});
export type Coordinate = z.infer<typeof CoordinateSchema>;

/** A viewport, used to fetch only the vendors inside the current map window. */
export const RegionSchema = CoordinateSchema.extend({
  latitudeDelta: z.number(),
  longitudeDelta: z.number(),
});
export type Region = z.infer<typeof RegionSchema>;

export const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string().optional(),
  country: z.string().default('US'),
  /** Nearest interstate + exit, e.g. "I-80 & Exit 204" — a first-class field for truckers. */
  interstateMarker: z.string().optional(),
});
export type Address = z.infer<typeof AddressSchema>;
