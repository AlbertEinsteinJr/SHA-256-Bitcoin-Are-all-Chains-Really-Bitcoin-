import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Two-tier persistence, matching the native storage libraries in the real build:
 *   - SecureStore (Keychain / Keystore) for tokens — never in plain AsyncStorage.
 *   - AsyncStorage for non-secret cached JSON (last region, react-query cache, flags).
 * The offline record store (vendors/repairs/rates) lives in SQLite — see data/db.ts.
 */
export const secureStorage = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  remove: (key: string) => SecureStore.deleteItemAsync(key),
};

export const kvStorage = {
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  setJSON: (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value)),
  remove: (key: string) => AsyncStorage.removeItem(key),
};

export const StorageKeys = {
  session: 'session', // secure
  lastRegion: 'last_region',
  syncCursor: 'sync_cursor',
  onboardingSeen: 'onboarding_seen',
} as const;
