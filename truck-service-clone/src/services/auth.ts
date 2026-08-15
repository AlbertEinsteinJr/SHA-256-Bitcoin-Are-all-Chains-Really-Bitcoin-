import auth from '@react-native-firebase/auth';
import { apiSend, setSessionCache } from './apiClient';
import { endpoints } from '@config/endpoints';
import { secureStorage, StorageKeys } from './storage';
import { UserSchema, type Session } from '@models/index';
import { z } from 'zod';

/**
 * Auth flow (matches the React Native Firebase dependency in the real build):
 *   1. Firebase authenticates the credential (email/password, Apple, Google).
 *   2. We exchange the Firebase ID token for a first-party app JWT at /auth/session,
 *      so the backend Lambdas verify our own short-lived token, not Firebase's.
 *   3. The Session (app JWT + refresh token + user) is persisted to SecureStore.
 */
const SessionResponseSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
});

async function exchangeAndPersist(): Promise<Session> {
  const idToken = await auth().currentUser?.getIdToken();
  if (!idToken) throw new Error('No Firebase ID token available');
  const session = await apiSend('post', endpoints.session, { idToken }, SessionResponseSchema);
  await secureStorage.set(StorageKeys.session, JSON.stringify(session));
  setSessionCache(session);
  return session;
}

export const authService = {
  async signInWithEmail(email: string, password: string): Promise<Session> {
    await auth().signInWithEmailAndPassword(email, password);
    return exchangeAndPersist();
  },

  async register(email: string, password: string): Promise<Session> {
    await auth().createUserWithEmailAndPassword(email, password);
    return exchangeAndPersist();
  },

  async restore(): Promise<Session | null> {
    const raw = await secureStorage.get(StorageKeys.session);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    setSessionCache(session);
    return session;
  },

  async signOut(): Promise<void> {
    await auth().signOut();
    await secureStorage.remove(StorageKeys.session);
    setSessionCache(null);
  },
};
