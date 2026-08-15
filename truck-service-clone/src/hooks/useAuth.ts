/**
 * Ergonomic view over the Zustand auth store for screens. Selects only the slice
 * a screen needs (status + user + the three actions) so a component re-renders on
 * auth changes but not on unrelated store churn. Search works signed-out; the
 * account-scoped sync features gate on `status === 'signedIn'`.
 */
import { useAuthStore } from '@store/authStore';

export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const register = useAuthStore((s) => s.register);
  const signOut = useAuthStore((s) => s.signOut);

  return { status, user, signIn, register, signOut };
}
