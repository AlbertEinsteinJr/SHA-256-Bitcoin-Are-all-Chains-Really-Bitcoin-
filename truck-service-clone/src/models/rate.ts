import { z } from 'zod';

/**
 * A private, per-vendor rate the user records to compare pricing across shops
 * (the "Rates" feature). Distinct from a public Rating. Never shared with the vendor.
 */
export const RateSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  ownerId: z.string(),
  laborHourly: z.number().nonnegative().optional(),
  afterHoursHourly: z.number().nonnegative().optional(),
  serviceCallFee: z.number().nonnegative().optional(),
  mileageFee: z.number().nonnegative().optional(),
  currency: z.string().default('USD'),
  note: z.string().max(1000).optional(),
  updatedAt: z.string().datetime(),
  pendingSync: z.boolean().default(false),
});
export type Rate = z.infer<typeof RateSchema>;
