/**
 * MapScreen (MapTab) — the geospatial half of the directory.
 * Renders the live vendor set on a MapView: useLocation() seeds the initial
 * region, useNearbyVendors() supplies the pins, and panning the map writes the
 * new viewport back into useSearchStore so the query re-runs for what's on screen.
 * Tapping a pin hops to the sibling SearchTab's VendorDetail (map and list share
 * one detail screen).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import MapView, { Region as MapRegion } from 'react-native-maps';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { AppTabsParamList } from '@/navigation/types';
import type { Vendor, Region } from '@models/index';
import { MapMarker } from '@components/MapMarker';
import { useLocation } from '@hooks/useLocation';
import { useNearbyVendors } from '@hooks/useNearbyVendors';
import { useSearchStore } from '@store/searchStore';
import { useTheme, type Theme } from '@theme/index';

// Fallback viewport (Kansas City freight crossroads) until a fix or stored region.
const FALLBACK_REGION: Region = {
  latitude: 39.0997,
  longitude: -94.5786,
  latitudeDelta: 0.4,
  longitudeDelta: 0.4,
};

type Props = BottomTabScreenProps<AppTabsParamList, 'MapTab'>;

export default function MapScreen({ navigation }: Props) {
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);

  const { coordinate, loading, error, refresh } = useLocation();
  const storeRegion = useSearchStore((st) => st.region);
  const setRegion = useSearchStore((st) => st.setRegion);
  const { vendors, isLoading, refetch } = useNearbyVendors(coordinate);

  const [region, setLocalRegion] = useState<Region>(storeRegion ?? FALLBACK_REGION);

  // Recenter once we get a device fix (only if the user hasn't already panned).
  useEffect(() => {
    if (coordinate && !storeRegion) {
      setLocalRegion({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: 0.25,
        longitudeDelta: 0.25,
      });
    }
  }, [coordinate, storeRegion]);

  const onRegionChangeComplete = (r: MapRegion) => {
    const next: Region = {
      latitude: r.latitude,
      longitude: r.longitude,
      latitudeDelta: r.latitudeDelta,
      longitudeDelta: r.longitudeDelta,
    };
    setLocalRegion(next);
    setRegion(next); // drives the vendor query's geo bounds
  };

  const openVendor = (vendor: Vendor) => {
    // Cross-tab jump: the detail screen lives in the Search stack.
    navigation.navigate('SearchTab', {
      screen: 'VendorDetail',
      params: { vendorId: vendor.id },
    });
  };

  return (
    <View style={s.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        region={region}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
      >
        {vendors.map((vendor) => (
          <MapMarker key={vendor.id} vendor={vendor} onPress={() => openVendor(vendor)} />
        ))}
      </MapView>

      {/* Floating status + recenter cluster, overlaid on the map surface. */}
      <View style={s.overlay} pointerEvents="box-none">
        <View style={s.pill}>
          {isLoading || loading ? (
            <ActivityIndicator size="small" color={theme.colors.accent} />
          ) : (
            <Text style={s.pillText}>
              {vendors.length} service {vendors.length === 1 ? 'provider' : 'providers'} in view
            </Text>
          )}
        </View>

        {error ? (
          <Pressable style={[s.pill, s.errorPill]} onPress={refresh}>
            <Text style={s.errorText}>Location unavailable · tap to retry</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        style={s.fab}
        onPress={() => {
          refresh();
          refetch();
        }}
        accessibilityLabel="Recenter on my location"
      >
        <Text style={s.fabIcon}>◎</Text>
      </Pressable>
    </View>
  );
}

function createStyles(t: Theme) {
  const { colors, spacing, radius } = t;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    overlay: {
      position: 'absolute',
      top: spacing.lg,
      left: spacing.lg,
      right: spacing.lg,
      gap: spacing.sm,
      alignItems: 'flex-start',
    },
    pill: {
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    pillText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
    errorPill: { backgroundColor: colors.danger },
    errorText: { color: colors.accentInk, fontSize: 12, fontWeight: '600' },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.xl,
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },
    fabIcon: { color: colors.accentInk, fontSize: 24, marginTop: -2 },
  });
}
