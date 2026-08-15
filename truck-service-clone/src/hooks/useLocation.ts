/**
 * Resolves the device's current position and, as a side effect, seeds the search
 * store's map region so the directory query and the map open centered on the
 * driver. Owns the permission/loading/error state for any "Use my location"
 * affordance. The deltas below frame roughly a ~35-mile window — a sensible
 * default radius for finding roadside service.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Coordinate } from '@models/index';
import { locationService } from '@services/location';
import { useSearchStore } from '@store/searchStore';

// ~0.5 degrees latitude ≈ 35 miles; longitude delta widened for typical aspect ratios.
const REGION_LATITUDE_DELTA = 0.5;
const REGION_LONGITUDE_DELTA = 0.5;

interface UseLocationResult {
  coordinate: Coordinate | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useLocation(): UseLocationResult {
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const granted = await locationService.requestPermission();
      if (!granted) {
        setError('Location permission is required to find nearby service.');
        return;
      }
      const current = await locationService.getCurrent();
      setCoordinate(current);
      useSearchStore.getState().setRegion({
        latitude: current.latitude,
        longitude: current.longitude,
        latitudeDelta: REGION_LATITUDE_DELTA,
        longitudeDelta: REGION_LONGITUDE_DELTA,
      });
    } catch {
      setError('Could not get your location. Check GPS signal and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { coordinate, loading, error, refresh };
}
