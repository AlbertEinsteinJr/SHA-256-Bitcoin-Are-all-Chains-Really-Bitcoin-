/**
 * ResultsScreen — the vendor result list for a chosen category / query.
 * ROLE: bridges route params (which serviceTypes to show) and the live geo
 * filter in searchStore, then renders the react-query-backed nearby feed.
 * The incoming serviceTypes are written into searchStore so useNearbyVendors —
 * which keys its infinite query off the store + current coordinate — refetches;
 * radius and "my vendors" chips mutate the same store, closing the loop.
 */
import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SearchStackParamList } from '@/navigation/types';
import type { ServiceType } from '@models/index';
import { useTheme, type Theme } from '@theme/index';
import { useSearchStore } from '@store/searchStore';
import { useLocation } from '@hooks/useLocation';
import { useNearbyVendors } from '@hooks/useNearbyVendors';
import { VendorList } from '@components/VendorList';

type Props = NativeStackScreenProps<SearchStackParamList, 'Results'>;

const RADIUS_OPTIONS = [10, 25, 50, 100] as const;

export default function ResultsScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme.scheme]);

  const paramKey = (route.params?.serviceTypes ?? []).join(',');
  const radiusMiles = useSearchStore((s) => s.radiusMiles);
  const onlyMyVendors = useSearchStore((s) => s.onlyMyVendors);
  const setRadius = useSearchStore((s) => s.setRadius);
  const setOnlyMyVendors = useSearchStore((s) => s.setOnlyMyVendors);

  // Sync the route's category selection into the shared filter the query reads.
  useEffect(() => {
    const types = (route.params?.serviceTypes ?? []) as ServiceType[];
    useSearchStore.setState({ activeServiceTypes: types });
  }, [paramKey]);

  useEffect(() => {
    navigation.setOptions({ title: route.params?.title ?? 'Results' });
  }, [navigation, route.params?.title]);

  const { coordinate } = useLocation();
  const { vendors, isLoading, fetchNextPage, hasNextPage, refetch } = useNearbyVendors(coordinate);

  return (
    <View style={styles.screen}>
      <View style={styles.filters}>
        <View style={styles.chipRow}>
          {RADIUS_OPTIONS.map((miles) => {
            const active = miles === radiusMiles;
            return (
              <Pressable
                key={miles}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setRadius(miles)}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{miles} mi</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: onlyMyVendors }}
          onPress={() => setOnlyMyVendors(!onlyMyVendors)}
          style={({ pressed }) => [
            styles.chip,
            onlyMyVendors && styles.chipActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.chipLabel, onlyMyVendors && styles.chipLabelActive]}>
            {onlyMyVendors ? '✓ ' : ''}My vendors
          </Text>
        </Pressable>
      </View>

      <VendorList
        vendors={vendors}
        refreshing={isLoading}
        onPressVendor={(v) => navigation.navigate('VendorDetail', { vendorId: v.id })}
        onEndReached={() => {
          if (hasNextPage) fetchNextPage();
        }}
      />

      {!isLoading && vendors.length > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => refetch()} style={styles.refreshBtn}>
          <Text style={styles.refreshLabel}>↻ Refresh results</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(theme: Theme) {
  const { colors, spacing, radius, typography } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    filters: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
      backgroundColor: colors.surface,
    },
    chipRow: { flexDirection: 'row', gap: spacing.sm },
    chip: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.pill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.bg,
    },
    chipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
    chipLabel: { ...typography.label, fontWeight: '600', color: colors.muted, letterSpacing: 0 },
    chipLabelActive: { color: colors.accentInk },
    refreshBtn: { alignItems: 'center', paddingVertical: spacing.sm, backgroundColor: colors.bg },
    refreshLabel: { ...typography.label, fontWeight: '600', color: colors.accent, letterSpacing: 0 },
    pressed: { opacity: 0.85 },
  });
}
