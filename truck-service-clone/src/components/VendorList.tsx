/**
 * VendorList — the scrolling column of search results.
 * ROLE: thin FlatList wrapper around VendorCard that owns the list-level concerns
 * (keying, infinite-scroll paging via onEndReached, pull-to-refresh, and the
 * empty state) so the Results and Saved screens can stay declarative. Purely
 * presentational: it receives already-fetched vendors and forwards taps upward.
 */
import React, { useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, ListRenderItemInfo } from 'react-native';
import { useTheme } from '@theme/index';
import type { Vendor } from '@models/index';
import { VendorCard } from '@components/VendorCard';

export function VendorList({
  vendors,
  onPressVendor,
  onEndReached,
  refreshing,
}: {
  vendors: Vendor[];
  onPressVendor: (v: Vendor) => void;
  onEndReached?: () => void;
  refreshing?: boolean;
}) {
  const { colors, spacing, typography } = useTheme();

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Vendor>) => (
      <VendorCard vendor={item} onPress={() => onPressVendor(item)} />
    ),
    [onPressVendor],
  );

  return (
    <FlatList
      data={vendors}
      keyExtractor={(v) => v.id}
      renderItem={renderItem}
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingVertical: spacing.sm,
        flexGrow: 1,
      }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      refreshControl={
        onEndReached || refreshing !== undefined ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onEndReached}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        ) : undefined
      }
      ListEmptyComponent={
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.xxl,
          }}
        >
          <Text style={{ fontSize: 40, marginBottom: spacing.md }}>🛻</Text>
          <Text style={[typography.title, { color: colors.ink, textAlign: 'center' }]}>
            No service providers here yet
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
            ]}
          >
            Widen your radius or clear a filter — we search the full roadside directory
            around your location.
          </Text>
        </View>
      }
    />
  );
}
