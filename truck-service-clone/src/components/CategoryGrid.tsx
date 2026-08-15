/**
 * CategoryGrid — the "what broke?" launcher on the search home screen.
 * ROLE: renders the top-level service taxonomy (mobile repair, towing, tire, reefer…)
 * as a responsive grid of tappable tiles. Each tile reports its `serviceType` upward
 * so SearchHome can push a pre-filtered Results screen. Icons are emoji glyphs, so the
 * grid ships with no image assets. Layout self-sizes to the viewport width.
 */
import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { useTheme } from '@theme/index';
import type { Category, ServiceType } from '@models/index';

/** Emoji fallback per service type, keyed off the coarse grouping the API returns. */
const SERVICE_ICON: Record<ServiceType, string> = {
  mobile_repair: '🔧',
  repair_shop: '🏭',
  towing: '🪝',
  tire: '🛞',
  reefer: '❄️',
  dealer: '🚚',
  truck_stop: '⛽',
  truck_wash: '🚿',
  parts: '⚙️',
};

export function CategoryGrid({
  categories,
  onSelect,
}: {
  categories: Category[];
  onSelect: (serviceType: ServiceType) => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const { width } = useWindowDimensions();

  // Two columns on phones, three once there's room (tablets / landscape).
  const columns = width >= 600 ? 3 : 2;
  const gap = spacing.md;
  const tileWidth = `${100 / columns}%` as const;

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: spacing.lg - gap / 2,
      }}
    >
      {categories.map((cat) => (
        <View key={cat.id} style={{ width: tileWidth, padding: gap / 2 }}>
          <Pressable
            onPress={() => onSelect(cat.serviceType)}
            accessibilityRole="button"
            accessibilityLabel={cat.label}
            style={({ pressed }) => ({
              backgroundColor: colors.surface,
              borderColor: colors.line,
              borderWidth: 1,
              borderRadius: radius.md,
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing.md,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 96,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontSize: 28, marginBottom: spacing.sm }}>
              {SERVICE_ICON[cat.serviceType] ?? '📍'}
            </Text>
            <Text
              numberOfLines={2}
              style={[
                typography.label,
                { color: colors.ink, textAlign: 'center', letterSpacing: 0 },
              ]}
            >
              {cat.label}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
