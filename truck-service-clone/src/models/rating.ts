import { z } from 'zod';

/** A driver's rating of a vendor. Syncs to the account and shows "instantly" (optimistic). */
export const RatingSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  authorId: z.string(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  photoUrls: z.array(z.string().url()).optional(),
  createdAt: z.string().datetime(),
  /** Local-only flag: created offline, not yet POSTed. Drives the sync queue. */
  pendingSync: z.boolean().default(false),
});
export type Rating = z.infer<typeof RatingSchema>;

export type NewRating = Pick<Rating, 'vendorId' | 'stars' | 'comment' | 'photoUrls'>;
