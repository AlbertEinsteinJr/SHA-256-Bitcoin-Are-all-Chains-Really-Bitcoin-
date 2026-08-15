/**
 * VendorCard — the primary search-result row for a repair shop / towing / tire vendor.
 * ROLE: pure presentation of one `Vendor`. It encodes the monetization model visually:
 * the paid `tier` drives a colored badge and how rich the card renders (premium/standard
 * get description + amenities), and `authorizedVendor` shows the financing chip. Higher
 * tiers are what the search ranker floats to the top, so the card is the visible payoff.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@theme/index';
import type { Vendor, ListingTier } from '@models/index';
import { RatingStars } from '@components/RatingStars';

const TIER_LABEL: Record<ListingTier, string> = {
  free: 'Basic Listing',
  basic: 'Basic',
  basic_plus: 'Basic Plus',
  standard: 'Standard',
  premium: 'Premium',
};

/** Which tiers get the richer, "featured" treatment on the card. */
function isFeatured(tier: ListingTier): boolean {
  return tier === 'premium' || tier === 'standard';
}

export function VendorCard({
  vendor,
  onPress,
}: {
  vendor: Vendor;
  onPress?: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const featured = isFeatured(vendor.tier);
  const primaryPhone = vendor.phones[0];

  // Tier badge color: premium is the navy accent, standard the "good" green,
  // everything below is a quiet neutral so the paid tiers stand out.
  const badgeColor =
    vendor.tier === 'premium'
      ? colors.accent
      : vendor.tier === 'standard'
        ? colors.good
        : colors.muted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${vendor.name}, ${TIER_LABEL[vendor.tier]} listing`}
      style={({ pressed }) => [
        {
          backgroundColor: colors.surface,
          borderColor: featured ? badgeColor : colors.line,
          borderWidth: featured ? 1.5 : StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          padding: spacing.lg,
          marginHorizontal: spacing.lg,
          marginVertical: spacing.sm,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Header: name + tier badge */}
      <View style={styles.rowBetween}>
        <Text
          numberOfLines={1}
          style={[typography.title, { color: colors.ink, flex: 1, marginRight: spacing.sm }]}
        >
          {vendor.name}
        </Text>
        <View
          style={{
            backgroundColor: badgeColor,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
          }}
        >
          <Text style={[typography.label, { color: colors.accentInk }]}>
            {TIER_LABEL[vendor.tier].toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Chips row: authorized vendor + 24-hour hint */}
      {(vendor.authorizedVendor || vendor.hours?.some((h) => h.is24Hour)) && (
        <View style={[styles.chipRow, { marginTop: spacing.xs }]}>
          {vendor.authorizedVendor && (
            <Chip color={colors.good} bg={colors.surface} border={colors.good}>
              ✓ Authorized Vendor
            </Chip>
          )}
          {vendor.hours?.some((h) => h.is24Hour) && (
            <Chip color={colors.safety} bg={colors.surface} border={colors.safety}>
              24/7 Roadside
            </Chip>
          )}
        </View>
      )}

      {/* Rating + distance line */}
      <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <RatingStars value={vendor.averageRating ?? 0} size={14} />
          <Text style={[typography.body, { color: colors.muted, marginLeft: spacing.xs }]}>
            {vendor.averageRating ? vendor.averageRating.toFixed(1) : 'New'}
            {vendor.ratingCount > 0 ? ` (${vendor.ratingCount})` : ''}
          </Text>
        </View>
        {typeof vendor.distanceMiles === 'number' && (
          <Text style={[typography.label, { color: colors.accent }]}>
            {vendor.distanceMiles.toFixed(1)} mi
          </Text>
        )}
      </View>

      {/* Location line — interstate marker is a first-class trucker field */}
      <Text
        numberOfLines={1}
        style={[typography.body, { color: colors.muted, marginTop: spacing.xs }]}
      >
        {vendor.address.interstateMarker
          ? `${vendor.address.interstateMarker} · `
          : ''}
        {vendor.address.city}, {vendor.address.state}
      </Text>

      {/* Featured extras: short pitch + amenity tags for paid tiers */}
      {featured && vendor.description && (
        <Text
          numberOfLines={2}
          style={[typography.body, { color: colors.ink, marginTop: spacing.sm }]}
        >
          {vendor.description}
        </Text>
      )}
      {featured && vendor.amenities && vendor.amenities.length > 0 && (
        <View style={[styles.chipRow, { marginTop: spacing.sm }]}>
          {vendor.amenities.slice(0, 4).map((a) => (
            <Chip key={a} color={colors.muted} bg={colors.bg} border={colors.line}>
              {a}
            </Chip>
          ))}
        </View>
      )}

      {/* Primary phone — the money action on a breakdown */}
      <View style={[styles.rowBetween, { marginTop: spacing.md }]}>
        <Text style={[typography.label, { color: colors.ink }]}>📞 {primaryPhone}</Text>
        <Text style={[typography.label, { color: colors.accent }]}>View details ›</Text>
      </View>
    </Pressable>
  );
}

/** Tiny rounded tag used for badges/amenities. */
function Chip({
  children,
  color,
  bg,
  border,
}: {
  children: React.ReactNode;
  color: string;
  bg: string;
  border: string;
}) {
  const { spacing, radius, typography } = useTheme();
  return (
    <View
      style={{
        backgroundColor: bg,
        borderColor: border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        marginRight: spacing.xs,
        marginBottom: spacing.xs,
      }}
    >
      <Text style={[typography.label, { color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});
