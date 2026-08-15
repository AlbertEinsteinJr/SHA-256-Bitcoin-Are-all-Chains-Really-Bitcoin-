import { z } from 'zod';

/** A fleet groups users, trucks, private locations, and shared repair tickets. */
export const TruckSchema = z.object({
  id: z.string(),
  fleetId: z.string(),
  unitNumber: z.string(),
  vin: z.string().optional(),
  nickname: z.string().optional(),
});
export type Truck = z.infer<typeof TruckSchema>;

export const FleetSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  memberIds: z.array(z.string()),
  trucks: z.array(TruckSchema),
});
export type Fleet = z.infer<typeof FleetSchema>;
