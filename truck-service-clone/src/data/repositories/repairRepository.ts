/**
 * Write model for the "Start a Repair" workflow. Repair tickets are the app's
 * offline-first, event-sourced feature: every mutation lands in SQLite first with
 * `pendingSync: true` so the UI updates instantly, then we kick a best-effort
 * `syncService.run()` to flush the queue if there's signal. Reads come straight
 * off the local cache, which the sync reconciler keeps fresh. Ticket updates are
 * appended (never overwritten) so concurrent fleet edits merge on the backend.
 */
import { db } from '@/data/db';
import { syncService } from '@services/sync';
import type { NewRepairTicket, RepairTicket, RepairUpdate } from '@models/index';

/** Small RFC4122-ish v4 id generator — avoids a native uuid dependency for local ids. */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Fire sync without blocking the optimistic write; connectivity may simply be absent. */
function flush(): void {
  syncService.run().catch(() => undefined);
}

export const repairRepository = {
  /** Offline-first list — the local cache is the source of truth for the tickets screen. */
  async list(): Promise<RepairTicket[]> {
    return db.getRepairs();
  },

  async get(id: string): Promise<RepairTicket | null> {
    return db.getRepair(id);
  },

  async create(input: NewRepairTicket, userId: string): Promise<RepairTicket> {
    const now = new Date().toISOString();
    const ticket: RepairTicket = {
      id: uuid(),
      createdBy: userId,
      truckId: input.truckId,
      vendorId: input.vendorId,
      status: 'open',
      title: input.title,
      breakdownLocation: input.breakdownLocation,
      totalCost: 0,
      updates: [
        {
          id: uuid(),
          authorId: userId,
          authorName: 'You',
          status: 'open',
          note: 'Repair ticket opened.',
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
      pendingSync: true,
    };
    await db.saveRepair(ticket);
    flush();
    return ticket;
  },

  async addUpdate(
    ticketId: string,
    update: Omit<RepairUpdate, 'id' | 'createdAt'>
  ): Promise<RepairTicket> {
    const existing = await db.getRepair(ticketId);
    if (!existing) throw new Error(`Repair ticket ${ticketId} not found`);

    const now = new Date().toISOString();
    const entry: RepairUpdate = { ...update, id: uuid(), createdAt: now };

    const next: RepairTicket = {
      ...existing,
      // Append-only log; concurrent fleet updates merge instead of clobbering.
      updates: [...existing.updates, entry],
      status: update.status ?? existing.status,
      totalCost: Math.max(0, existing.totalCost + (update.costDelta ?? 0)),
      updatedAt: now,
      pendingSync: true,
    };
    await db.saveRepair(next);
    flush();
    return next;
  },
};
