/**
 * MapMarker — one vendor pin on the MapScreen's react-native-maps view.
 * ROLE: adapts a `Vendor` to a native <Marker>. The pin color encodes the vendor's
 * primary `serviceType` (so towing vs. tire vs. reefer read at a glance), and the
 * attached <Callout> shows the name + star rating with a tap-through to VendorDetail.
 * Colors resolve through useTheme() so pins recolor correctly in dark mode.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import { useTheme } from '@theme/index';
import type { Vendor, ServiceType } from '@models/index';
import { RatingStars } from '@components/RatingStars';

/** Pick the theme color used for the map pin, keyed off the vendor's first service type. */
function pinColorFor(
  serviceType: ServiceType | undefined,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
  switch (serviceType) {
    case 'towing':
      return colors.danger; // urgent / recovery
    case 'tire':
      return colors.ink;
    case 'reefer':
      return colors.good; // cold chain
    case 'truck_stop':
      return colors.safety; // fuel / parking amber
    case 'truck_wash':
      return colors.muted;
    case 'mobile_repair':
    case 'repair_shop':
    case 'dealer':
    case 'parts':
    default:
      return colors.accent;
  }
}

export function MapMarker({
  vendor,
  onPress,
}: {
  vendor: Vendor;
  onPress: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const primaryType = vendor.serviceTypes[0];

  return (
    <Marker
      identifier={vendor.id}
      coordinate={vendor.coordinate}
      pinColor={pinColorFor(primaryType, colors)}
      title={vendor.name}
      tracksViewChanges={false}
    >
      <Callout onPress={onPress} tooltip>
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: radius.md,
            padding: spacing.md,
            minWidth: 180,
            maxWidth: 240,
          }}
        >
          <Text numberOfLines={1} style={[typography.title, { color: colors.ink, fontSize: 16 }]}>
            {vendor.name}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
            <RatingStars value={vendor.averageRating ?? 0} size={13} />
            <Text style={[typography.body, { color: colors.muted, marginLeft: spacing.xs }]}>
              {vendor.averageRating ? vendor.averageRating.toFixed(1) : 'New'}
              {vendor.ratingCount > 0 ? ` (${vendor.ratingCount})` : ''}
            </Text>
          </View>

          {typeof vendor.distanceMiles === 'number' && (
            <Text style={[typography.label, { color: colors.accent, marginTop: spacing.xs }]}>
              {vendor.distanceMiles.toFixed(1)} mi · tap for details ›
            </Text>
          )}
        </View>
      </Callout>
    </Marker>
  );
}
