import Constants from 'expo-constants';

/**
 * Typed accessor over the `extra` block in app.config.ts. Everything that varies
 * per environment (dev/preview/prod) funnels through here so no other module
 * touches Constants directly.
 */
interface AppEnv {
  apiBaseUrl: string;
  environment: 'development' | 'preview' | 'production';
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<AppEnv>;

export const env: AppEnv = {
  apiBaseUrl: extra.apiBaseUrl ?? 'https://api.example.com',
  environment: (extra.environment as AppEnv['environment']) ?? 'development',
};

export const isProd = env.environment === 'production';
