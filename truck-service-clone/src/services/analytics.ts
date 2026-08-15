/**
 * Product analytics seam over Firebase Analytics. Every method is fire-and-forget
 * and swallows its own errors — instrumentation must never crash a driver who is
 * standing on the shoulder of I-80 trying to find a tire shop. Screen-view logging
 * is driven off the React Navigation state so we get one clean funnel per tab/stack.
 */
import analyticsModule from '@react-native-firebase/analytics';

/** Walk a React Navigation state tree down to the currently-focused route name. */
function activeRouteName(state: any): string | undefined {
  if (!state || typeof state.index !== 'number' || !Array.isArray(state.routes)) return undefined;
  const route = state.routes[state.index];
  if (route?.state) return activeRouteName(route.state);
  return route?.name;
}

/** Guard every SDK call so a logging failure is a no-op, not a thrown error. */
function safe(run: () => Promise<unknown>): void {
  try {
    run().catch(() => undefined);
  } catch {
    // Analytics is best-effort; never surface to the UI.
  }
}

export const analytics = {
  logAppOpen(): void {
    safe(() => analyticsModule().logAppOpen());
  },

  logScreen(name: string): void {
    safe(() => analyticsModule().logScreenView({ screen_name: name, screen_class: name }));
  },

  /** Convenience for the navigation container's `onStateChange` callback. */
  logScreenFromNavState(state: any): void {
    const name = activeRouteName(state);
    if (name) this.logScreen(name);
  },

  logEvent(name: string, params?: Record<string, any>): void {
    safe(() => analyticsModule().logEvent(name, params));
  },
};
