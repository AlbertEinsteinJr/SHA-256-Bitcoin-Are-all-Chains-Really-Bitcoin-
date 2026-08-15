import { apiGet, apiSend } from './apiClient';
import { endpoints } from '@config/endpoints';
import { kvStorage, StorageKeys } from './storage';
import { db } from '@/data/db';
import { z } from 'zod';
import { RepairTicketSchema, RateSchema, RatingSchema, VendorSchema } from '@models/index';

/**
 * Offline-first delta sync. Mirrors the WorkManager + DataStore + SQLite trio in
 * the real build: local writes go to SQLite immediately with pendingSync=true and
 * the UI updates optimistically ("instantly"); this reconciler flushes the queue
 * and pulls a delta whenever connectivity returns or the app foregrounds.
 *
 *   push()  — POST every pendingSync record, clear the flag on success.
 *   pull()  — GET /sync?since=<cursor>, upsert changed records, advance the cursor.
 *
 * Conflict rule: repair tickets are event-logs (append updates, never overwrite),
 * so concurrent fleet edits merge; scalar records (rates/favorites) are last-writer-wins.
 */
const SyncEnvelopeSchema = z.object({
  cursor: z.string(),
  vendors: z.array(VendorSchema).default([]),
  repairs: z.array(RepairTicketSchema).default([]),
  rates: z.array(RateSchema).default([]),
  ratings: z.array(RatingSchema).default([]),
});

async function push(): Promise<void> {
  for (const rec of await db.pendingRepairs()) {
    await apiSend('post', endpoints.repairs, rec);
    await db.markSynced('repairs', rec.id);
  }
  for (const rec of await db.pendingRates()) {
    await apiSend('put', endpoints.rates, rec);
    await db.markSynced('rates', rec.id);
  }
  for (const rec of await db.pendingRatings()) {
    await apiSend('post', endpoints.vendorRatings(rec.vendorId), rec);
    await db.markSynced('ratings', rec.id);
  }
}

async function pull(): Promise<void> {
  const since = (await kvStorage.getJSON<string>(StorageKeys.syncCursor)) ?? '0';
  const delta = await apiGet(endpoints.sync, SyncEnvelopeSchema, { since });
  await db.upsertMany('vendors', delta.vendors);
  await db.upsertMany('repairs', delta.repairs);
  await db.upsertMany('rates', delta.rates);
  await db.upsertMany('ratings', delta.ratings);
  await kvStorage.setJSON(StorageKeys.syncCursor, delta.cursor);
}

export const syncService = {
  async run(): Promise<void> {
    await push();
    await pull();
  },
};
