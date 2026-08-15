/**
 * The on-device offline store — the SQLite half of the "SQLite + DataStore +
 * WorkManager" offline-first trio. Every syncable collection (vendors cache,
 * repair tickets, private rates, ratings) is persisted here as a generic row:
 * a stable `id`, the full record serialized into a JSON `data` column, and a
 * `pending` integer flag that marks a locally-created/edited record that has
 * not yet been POSTed to the backend.
 *
 * `@services/sync` is the only writer that clears the flag: it reads every
 * pending row (push()), and upserts the server delta back in (pull()). The
 * `pending` column — never a field inside the JSON — is the single source of
 * truth for "needs sync", so the flag and the payload can never drift.
 */
import * as SQLite from 'expo-sqlite';
import type { Vendor, RepairTicket, Rate, Rating } from '@models/index';

type Collection = 'vendors' | 'repairs' | 'rates' | 'ratings';

const COLLECTIONS: Collection[] = ['vendors', 'repairs', 'rates', 'ratings'];

interface Row {
  id: string;
  data: string;
  pending: number;
}

let database: SQLite.SQLiteDatabase | null = null;

/** Open the database and create the per-collection tables on first use. */
async function ensureDb(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;
  const handle = await SQLite.openDatabaseAsync('roadside.db');
  await handle.execAsync('PRAGMA journal_mode = WAL;');
  for (const name of COLLECTIONS) {
    await handle.execAsync(
      `CREATE TABLE IF NOT EXISTS ${name} (
         id TEXT PRIMARY KEY NOT NULL,
         data TEXT NOT NULL,
         pending INTEGER NOT NULL DEFAULT 0
       );`
    );
  }
  database = handle;
  return handle;
}

/** Rehydrate a stored row, forcing `pendingSync` to mirror the authoritative flag column. */
function parseRow<T>(row: Row): T {
  const parsed = JSON.parse(row.data) as Record<string, unknown>;
  parsed.pendingSync = row.pending === 1;
  return parsed as T;
}

async function upsertRow(
  handle: SQLite.SQLiteDatabase,
  collection: Collection,
  record: { id: string; pendingSync?: boolean }
): Promise<void> {
  const pending = record.pendingSync ? 1 : 0;
  await handle.runAsync(
    `INSERT OR REPLACE INTO ${collection} (id, data, pending) VALUES (?, ?, ?);`,
    record.id,
    JSON.stringify(record),
    pending
  );
}

export const db = {
  /** Idempotent bootstrap — call once at app start before the first read/write. */
  async init(): Promise<void> {
    await ensureDb();
  },

  /**
   * Bulk write used by `sync.pull()` to fold the server delta into the cache.
   * A record's own `pendingSync` decides the flag, so re-applying a still-pending
   * local write keeps it queued rather than silently marking it clean.
   */
  async upsertMany(collection: Collection, records: any[]): Promise<void> {
    if (records.length === 0) return;
    const handle = await ensureDb();
    await handle.withTransactionAsync(async () => {
      for (const record of records) {
        await upsertRow(handle, collection, record);
      }
    });
  },

  /** Clear the pending flag after `sync.push()` has POSTed the record successfully. */
  async markSynced(collection: 'repairs' | 'rates' | 'ratings', id: string): Promise<void> {
    const handle = await ensureDb();
    await handle.runAsync(`UPDATE ${collection} SET pending = 0 WHERE id = ?;`, id);
  },

  async pendingRepairs(): Promise<RepairTicket[]> {
    const handle = await ensureDb();
    const rows = await handle.getAllAsync<Row>('SELECT * FROM repairs WHERE pending = 1;');
    return rows.map((r) => parseRow<RepairTicket>(r));
  },

  async pendingRates(): Promise<Rate[]> {
    const handle = await ensureDb();
    const rows = await handle.getAllAsync<Row>('SELECT * FROM rates WHERE pending = 1;');
    return rows.map((r) => parseRow<Rate>(r));
  },

  async pendingRatings(): Promise<Rating[]> {
    const handle = await ensureDb();
    const rows = await handle.getAllAsync<Row>('SELECT * FROM ratings WHERE pending = 1;');
    return rows.map((r) => parseRow<Rating>(r));
  },

  /** All cached repair tickets, newest activity first — the offline-first list source. */
  async getRepairs(): Promise<RepairTicket[]> {
    const handle = await ensureDb();
    const rows = await handle.getAllAsync<Row>('SELECT * FROM repairs;');
    return rows
      .map((r) => parseRow<RepairTicket>(r))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async getRepair(id: string): Promise<RepairTicket | null> {
    const handle = await ensureDb();
    const row = await handle.getFirstAsync<Row>('SELECT * FROM repairs WHERE id = ?;', id);
    return row ? parseRow<RepairTicket>(row) : null;
  },

  /** Optimistic local write for a created/edited ticket; `pendingSync` drives the flag. */
  async saveRepair(t: RepairTicket): Promise<void> {
    const handle = await ensureDb();
    await upsertRow(handle, 'repairs', t);
  },

  /** Fallback directory used when a live vendor search can't reach the network. */
  async getCachedVendors(): Promise<Vendor[]> {
    const handle = await ensureDb();
    const rows = await handle.getAllAsync<Row>('SELECT * FROM vendors;');
    return rows.map((r) => parseRow<Vendor>(r));
  },
};
