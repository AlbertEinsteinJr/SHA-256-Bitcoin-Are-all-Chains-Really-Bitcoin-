/**
 * Thin wrapper over `expo-location`. The whole app talks to GPS through this one
 * seam so permission prompts and the raw geolocation API never leak into hooks
 * or screens — they just ask for a `Coordinate`. Used by `useLocation` to seed
 * the search origin and the initial map region on a breakdown.
 */
import * as Location from 'expo-location';
import type { Coordinate } from '@models/index';

export const locationService = {
  /** Ask for foreground ("while using the app") location access. Returns whether it was granted. */
  async requestPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  },

  /** One-shot current fix, normalized to the app's `Coordinate` shape. */
  async getCurrent(): Promise<Coordinate> {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  },
};
