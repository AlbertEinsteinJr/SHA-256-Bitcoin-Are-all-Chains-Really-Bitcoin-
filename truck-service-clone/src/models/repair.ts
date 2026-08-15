import { z } from 'zod';

/**
 * The "Start Repair" digital repair ticket — the workflow feature that turns the
 * directory into a breakdown-management tool. A ticket is created for a breakdown
 * incident and shared across a fleet team; everyone can add notes/updates until
 * it's closed. Modeled as a small event-sourced log so concurrent fleet edits
 * merge cleanly during sync.
 */
export const RepairStatusSchema = z.enum([
  'open',
  'vendor_contacted',
  'en_route',
  'in_progress',
  'completed',
  'cancelled',
]);
export type RepairStatus = z.infer<typeof RepairStatusSchema>;

export const RepairUpdateSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  status: RepairStatusSchema.optional(),
  note: z.string().optional(),
  costDelta: z.number().optional(),
  photoUrls: z.array(z.string().url()).optional(),
  createdAt: z.string().datetime(),
});
export type RepairUpdate = z.infer<typeof RepairUpdateSchema>;

export const RepairTicketSchema = z.object({
  id: z.string(),
  fleetId: z.string().optional(),
  createdBy: z.string(),
  truckId: z.string().optional(),
  vendorId: z.string().optional(),
  status: RepairStatusSchema,
  title: z.string(),
  breakdownLocation: z.string().optional(),
  totalCost: z.number().nonnegative().default(0),
  updates: z.array(RepairUpdateSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  pendingSync: z.boolean().default(false),
});
export type RepairTicket = z.infer<typeof RepairTicketSchema>;

export type NewRepairTicket = Pick<RepairTicket, 'title' | 'truckId' | 'vendorId' | 'breakdownLocation'>;
