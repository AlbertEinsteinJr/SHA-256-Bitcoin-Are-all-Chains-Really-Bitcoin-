import axios, { AxiosInstance, AxiosError } from 'axios';
import { z, ZodType } from 'zod';
import { env } from '@config/env';
import { endpoints } from '@config/endpoints';
import { secureStorage, StorageKeys } from './storage';
import type { Session } from '@models/index';

/**
 * The single HTTP gateway to the serverless backend.
 *
 * Responsibilities:
 *   - attach the app JWT to every request (from SecureStore),
 *   - transparently refresh an expired token once and retry,
 *   - validate every response body against a Zod schema so a malformed payload
 *     fails loudly at the boundary instead of corrupting the UI,
 *   - surface a normalized ApiError to callers / react-query.
 */
export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

let sessionCache: Session | null = null;
export function setSessionCache(session: Session | null) {
  sessionCache = session;
}

const http: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use(async (config) => {
  const token = sessionCache?.accessToken ?? (await loadToken());
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !(original as any)._retried) {
      (original as any)._retried = true;
      refreshing ??= refreshToken();
      const fresh = await refreshing;
      refreshing = null;
      if (fresh) {
        original.headers = original.headers ?? {};
        (original.headers as any).Authorization = `Bearer ${fresh}`;
        return http(original);
      }
    }
    throw toApiError(error);
  }
);

function toApiError(error: AxiosError): ApiError {
  const status = error.response?.status ?? 0;
  const message =
    (error.response?.data as any)?.message ?? error.message ?? 'Network error';
  return new ApiError(status, message, error.response?.data);
}

async function loadToken(): Promise<string | null> {
  const raw = await secureStorage.get(StorageKeys.session);
  if (!raw) return null;
  const session = JSON.parse(raw) as Session;
  sessionCache = session;
  return session.accessToken;
}

async function refreshToken(): Promise<string | null> {
  const raw = await secureStorage.get(StorageKeys.session);
  if (!raw) return null;
  const session = JSON.parse(raw) as Session;
  try {
    const { data } = await axios.post(`${env.apiBaseUrl}${endpoints.refresh}`, {
      refreshToken: session.refreshToken,
    });
    const next: Session = { ...session, ...data };
    await secureStorage.set(StorageKeys.session, JSON.stringify(next));
    sessionCache = next;
    return next.accessToken;
  } catch {
    await secureStorage.remove(StorageKeys.session);
    sessionCache = null;
    return null;
  }
}

/** GET + runtime-validate. `schema` is one of the exported model schemas. */
export async function apiGet<T>(path: string, schema: ZodType<T>, params?: object): Promise<T> {
  const { data } = await http.get(path, { params });
  return schema.parse(data);
}

export async function apiSend<T>(
  method: 'post' | 'put' | 'patch' | 'delete',
  path: string,
  body?: unknown,
  schema?: ZodType<T>
): Promise<T> {
  const { data } = await http.request({ method, url: path, data: body });
  return schema ? schema.parse(data) : (data as T);
}

/** Cursor-paged envelope shared by every list endpoint. */
export const pageSchema = <T>(item: ZodType<T>) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export { http };
