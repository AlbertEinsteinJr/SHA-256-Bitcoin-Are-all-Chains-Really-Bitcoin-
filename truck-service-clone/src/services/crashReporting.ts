/**
 * Crash + error reporting seam over Sentry. Centralizing it here means the rest
 * of the app captures exceptions and identifies users without importing the SDK
 * directly, and lets us tag every event with the build environment. Like
 * analytics, every method is defensive — reporting must never throw.
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { env, isProd } from '@config/env';

const dsn = (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn;

export const crashReporting = {
  /** Initialize the SDK once at app start. No-op if no DSN is configured (e.g. local dev). */
  init(): void {
    if (!dsn) return;
    try {
      Sentry.init({
        dsn,
        environment: env.environment,
        // Sample aggressively in prod only; keep dev traces cheap.
        tracesSampleRate: isProd ? 0.2 : 1.0,
        enableAutoSessionTracking: true,
      });
    } catch {
      // Never let telemetry setup block app boot.
    }
  },

  /** Record a handled error with optional structured context (e.g. { ticketId, vendorId }). */
  capture(error: unknown, ctx?: Record<string, any>): void {
    try {
      Sentry.captureException(error, ctx ? { extra: ctx } : undefined);
    } catch {
      // swallow
    }
  },

  /** Attach or clear the signed-in user so crashes are attributable across a session. */
  setUser(user: { id: string } | null): void {
    try {
      Sentry.setUser(user ? { id: user.id } : null);
    } catch {
      // swallow
    }
  },
};
