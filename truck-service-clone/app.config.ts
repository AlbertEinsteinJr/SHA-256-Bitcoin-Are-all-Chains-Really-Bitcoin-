import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Expo application config — the manifest that both native shells are generated from.
 *
 * This single file is why iOS and Android ship in lockstep: `expo prebuild` (or an
 * EAS build) reads it once and emits an Xcode project and a Gradle project that share
 * the same JS bundle, version string, permission strings, and native module set.
 *
 * Mirrors the observed real-world build:
 *   - min iOS 16.4, min Android API 24 (Android 7.0)
 *   - Google Maps (react-native-maps) with per-platform API keys
 *   - Location + Camera/Photos permissions with human-readable usage strings
 *   - Firebase config files injected as native resources
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Roadside Directory',
  slug: 'roadside-directory',
  version: '7.0.6',
  orientation: 'portrait',
  scheme: 'roadsidedir',
  userInterfaceStyle: 'automatic',
  newArchEnabled: false,
  runtimeVersion: { policy: 'appVersion' },
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0E1B2A',
  },
  updates: {
    // OTA JS updates (EAS Update / CodePush-equivalent). Lets the team ship the
    // "instant" fixes seen in release notes without a full store review.
    url: 'https://u.expo.dev/00000000-0000-0000-0000-000000000000',
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier: 'com.example.roadsidedirectory',
    buildNumber: '7060',
    supportsTablet: true,
    deploymentTarget: '16.4',
    config: { googleMapsApiKey: process.env.IOS_GOOGLE_MAPS_KEY },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'We use your location to show the nearest truck-service vendors and give directions.',
      NSCameraUsageDescription:
        'Attach photos to a repair ticket or a vendor rating.',
      NSPhotoLibraryUsageDescription:
        'Attach photos from your library to a repair ticket or rating.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.example.roadsidedirectory',
    versionCode: 7060,
    minSdkVersion: 24,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0E1B2A',
    },
    config: { googleMaps: { apiKey: process.env.ANDROID_GOOGLE_MAPS_KEY } },
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'CAMERA',
      'INTERNET',
      'POST_NOTIFICATIONS',
    ],
  },
  plugins: [
    'expo-location',
    'expo-secure-store',
    'expo-image-picker',
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    [
      'expo-build-properties',
      {
        ios: { deploymentTarget: '16.4', useFrameworks: 'static' },
        android: { minSdkVersion: 24, compileSdkVersion: 34, targetSdkVersion: 34 },
      },
    ],
    [
      '@sentry/react-native/expo',
      { organization: 'roadside-directory', project: 'mobile' },
    ],
  ],
  extra: {
    apiBaseUrl: process.env.API_BASE_URL ?? 'https://api.example.com',
    environment: process.env.APP_ENV ?? 'development',
    sentryDsn: process.env.SENTRY_DSN,
    eas: { projectId: '00000000-0000-0000-0000-000000000000' },
  },
});
