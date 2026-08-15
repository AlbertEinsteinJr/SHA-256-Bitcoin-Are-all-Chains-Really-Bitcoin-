import { z } from 'zod';

export const AccountTypeSchema = z.enum(['driver', 'dispatcher', 'fleet_manager', 'vendor']);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().optional(),
  accountType: AccountTypeSchema,
  fleetId: z.string().optional(),
  photoUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

/** What auth.ts returns after a successful Firebase sign-in + backend session exchange. */
export interface Session {
  user: User;
  /** Backend JWT (exchanged from the Firebase ID token). Kept in SecureStore. */
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
