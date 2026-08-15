import { create } from 'zustand';
import { authService } from '@services/auth';
import type { Session, User } from '@models/index';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  restore: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/** Client-side auth state. RootNavigator switches stacks on `status`. */
export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  session: null,

  restore: async () => {
    const session = await authService.restore();
    set(session ? { status: 'signedIn', session, user: session.user } : { status: 'signedOut' });
  },

  signIn: async (email, password) => {
    const session = await authService.signInWithEmail(email, password);
    set({ status: 'signedIn', session, user: session.user });
  },

  register: async (email, password) => {
    const session = await authService.register(email, password);
    set({ status: 'signedIn', session, user: session.user });
  },

  signOut: async () => {
    await authService.signOut();
    set({ status: 'signedOut', session: null, user: null });
  },
}));
