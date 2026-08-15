/**
 * VendorDetailScreen — the full profile for a single directory listing.
 * ROLE: the conversion surface of the Search stack. Loads the vendor via
 * react-query (vendorRepository.getById), exposes the tap-to-act affordances a
 * stranded driver needs (call, directions, website), and hosts the two
 * account-scoped write features — a public star Rating (POST) and a private
 * Rate record (RateTracker) — plus the cross-tab jump into the Repairs stack to
 * open a ticket against this vendor.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { SearchStackParamList, AppTabsParamList } from '@/navigation/types';
import {
  RatingSchema,
  type ListingTier,
  type Rate,
  type ServiceType,
  type Vendor,
} from '@models/index';
import { useTheme, type Theme } from '@theme/index';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@store/queryClient';
import { vendorRepository } from '@/data/repositories/vendorRepository';
import { useAuth } from '@hooks/useAuth';
import { apiSend } from '@services/apiClient';
import { endpoints } from '@config/endpoints';
import { RatingStars } from '@components/RatingStars';
import { RateTracker } from '@components/RateTracker';

type Props = NativeStackScreenProps<SearchStackParamList, 'VendorDetail'>;

const SERVICE_LABELS: Record<ServiceType, string> = {
  mobile_repair: 'Mobile repair',
  repair_shop: 'Repair shop',
  towing: 'Towing',
  tire: 'Tire service',
  reefer: 'Reefer',
  dealer: 'Dealer',
  truck_stop: 'Truck stop',
  truck_wash: 'Truck wash',
  parts: 'Parts',
};

const TIER_LABELS: Record<ListingTier, string> = {
  free: 'Basic listing',
  basic: 'Basic',
  basic_plus: 'Basic+',
  standard: 'Standard',
  premium: 'Premium',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function VendorDetailScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme.scheme]);
  const { vendorId } = route.params;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const vendorQuery = useQuery({
    queryKey: queryKeys.vendor(vendorId),
    queryFn: () => vendorRepository.getById(vendorId),
  });

  // Public rating composer state.
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [ratingState, setRatingState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  // Private rate record (RateTracker) — never shared with the vendor.
  const [rate, setRate] = useState<Rate | undefined>(undefined);

  const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`);

  const openDirections = (v: Vendor) => {
    const { latitude, longitude } = v.coordinate;
    const label = encodeURIComponent(v.name);
    const url =
      Platform.select({
        ios: `http://maps.apple.com/?q=${label}&ll=${latitude},${longitude}`,
        default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
      }) ?? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  const submitRating = async () => {
    if (stars < 1 || ratingState === 'submitting') return;
    setRatingState('submitting');
    try {
      await apiSend(
        'post',
        endpoints.vendorRatings(vendorId),
        { vendorId, stars, comment: comment.trim() || undefined },
        RatingSchema
      );
      setRatingState('done');
      // Refresh the header's average/count now that a new rating landed.
      queryClient.invalidateQueries({ queryKey: queryKeys.vendor(vendorId) });
    } catch {
      setRatingState('error');
    }
  };

  const saveRate = async (patch: Partial<Rate>) => {
    // Optimistic: mark pending, fire the PUT; the sync service flushes on failure.
    const next: Rate = {
      id: rate?.id ?? `local-rate-${vendorId}`,
      vendorId,
      ownerId: user?.id ?? 'me',
      currency: rate?.currency ?? 'USD',
      ...rate,
      ...patch,
      updatedAt: new Date().toISOString(),
      pendingSync: true,
    };
    setRate(next);
    try {
      await apiSend('put', endpoints.rates, { vendorId, ...patch });
      setRate({ ...next, pendingSync: false });
    } catch {
      /* stays pendingSync: true for the offline queue */
    }
  };

  const startRepairHere = () => {
    // Cross-tab jump: hop out of the Search stack, into the Repairs tab's
    // StartRepair route, pre-filling this vendor.
    navigation
      .getParent<BottomTabNavigationProp<AppTabsParamList>>()
      ?.navigate('RepairsTab', { screen: 'StartRepair', params: { vendorId } });
  };

  if (vendorQuery.isLoading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={styles.centerText}>Loading vendor…</Text>
      </View>
    );
  }

  if (vendorQuery.isError || !vendorQuery.data) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.centerText}>We couldn’t load this vendor.</Text>
        <Pressable accessibilityRole="button" onPress={() => vendorQuery.refetch()}>
          <Text style={styles.retryLink}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const vendor = vendorQuery.data;
  const { address } = vendor;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.name}>{vendor.name}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>{TIER_LABELS[vendor.tier]}</Text>
            </View>
            {vendor.authorizedVendor ? (
              <View style={styles.authBadge}>
                <Text style={styles.authBadgeText}>✓ Authorized Vendor</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.ratingSummary}>
        <RatingStars value={vendor.averageRating ?? 0} size={18} />
        <Text style={styles.ratingText}>
          {vendor.averageRating ? vendor.averageRating.toFixed(1) : 'No ratings'} · {vendor.ratingCount}{' '}
          review{vendor.ratingCount === 1 ? '' : 's'}
          {typeof vendor.distanceMiles === 'number' ? ` · ${vendor.distanceMiles.toFixed(1)} mi` : ''}
        </Text>
      </View>

      <View style={styles.serviceChips}>
        {vendor.serviceTypes.map((st) => (
          <View key={st} style={styles.serviceChip}>
            <Text style={styles.serviceChipText}>{SERVICE_LABELS[st]}</Text>
          </View>
        ))}
      </View>

      {/* Address */}
      <View style={styles.card}>
        <Text style={styles.addressLine}>
          {[address.street, address.city].filter(Boolean).join(', ')}
        </Text>
        <Text style={styles.addressSub}>
          {[address.state, address.postalCode].filter(Boolean).join(' ')}
        </Text>
        {address.interstateMarker ? (
          <Text style={styles.interstate}>🛣  {address.interstateMarker}</Text>
        ) : null}
        {vendor.lastVerifiedAt ? (
          <Text style={styles.verified}>
            Verified {new Date(vendor.lastVerifiedAt).toLocaleDateString()}
          </Text>
        ) : null}
      </View>

      {/* Primary actions */}
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => call(vendor.phones[0])}
          style={({ pressed }) => [styles.actionBtn, styles.actionPrimary, pressed && styles.pressed]}
        >
          <Text style={styles.actionPrimaryLabel}>📞 Call</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => openDirections(vendor)}
          style={({ pressed }) => [styles.actionBtn, styles.actionSecondary, pressed && styles.pressed]}
        >
          <Text style={styles.actionSecondaryLabel}>🧭 Directions</Text>
        </Pressable>
        {vendor.website ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => Linking.openURL(vendor.website!)}
            style={({ pressed }) => [styles.actionBtn, styles.actionSecondary, pressed && styles.pressed]}
          >
            <Text style={styles.actionSecondaryLabel}>🌐 Website</Text>
          </Pressable>
        ) : null}
      </View>

      {vendor.phones.length > 1 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>All numbers</Text>
          {vendor.phones.map((p) => (
            <Pressable key={p} accessibilityRole="button" onPress={() => call(p)}>
              <Text style={styles.phoneLink}>{p}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {vendor.description ? (
        <View style={styles.card}>
          <Text style={styles.bodyText}>{vendor.description}</Text>
        </View>
      ) : null}

      {/* Hours */}
      {vendor.hours && vendor.hours.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hours</Text>
          {vendor.hours.map((h) => (
            <View key={h.dayOfWeek} style={styles.hoursRow}>
              <Text style={styles.hoursDay}>{DAY_NAMES[h.dayOfWeek]}</Text>
              <Text style={styles.hoursValue}>
                {h.is24Hour ? 'Open 24 hours' : `${h.open} – ${h.close}`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Amenities */}
      {vendor.amenities && vendor.amenities.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Amenities</Text>
          <View style={styles.amenityWrap}>
            {vendor.amenities.map((a) => (
              <View key={a} style={styles.amenityChip}>
                <Text style={styles.amenityText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Public rating composer */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Rate this vendor</Text>
        {ratingState === 'done' ? (
          <Text style={styles.successText}>Thanks — your rating was posted.</Text>
        ) : (
          <>
            <RatingStars value={stars} size={34} onChange={setStars} />
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="How was the service? (optional)"
              placeholderTextColor={theme.colors.muted}
              multiline
            />
            {ratingState === 'error' ? (
              <Text style={styles.errorText}>Couldn’t post your rating. Try again.</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={stars < 1 || ratingState === 'submitting'}
              onPress={submitRating}
              style={({ pressed }) => [
                styles.submitBtn,
                (stars < 1 || ratingState === 'submitting') && styles.btnDisabled,
                pressed && styles.pressed,
              ]}
            >
              {ratingState === 'submitting' ? (
                <ActivityIndicator color={theme.colors.accentInk} />
              ) : (
                <Text style={styles.submitLabel}>Post rating</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      {/* Private rate tracker */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your private rates</Text>
        <Text style={styles.helperText}>
          Track this shop’s pricing to compare across vendors. Only you can see this.
        </Text>
        <RateTracker rate={rate} onSave={saveRate} />
        {rate?.pendingSync ? <Text style={styles.pendingText}>Saved locally — will sync</Text> : null}
      </View>

      {/* Cross-tab: open a repair ticket against this vendor */}
      <Pressable
        accessibilityRole="button"
        onPress={startRepairHere}
        style={({ pressed }) => [styles.repairBtn, pressed && styles.pressed]}
      >
        <Text style={styles.repairLabel}>🧰 Start a repair here</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(theme: Theme) {
  const { colors, spacing, radius, typography } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
    centerScreen: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    centerText: { ...typography.body, color: colors.muted },
    retryLink: { ...typography.body, fontWeight: '700', color: colors.accent },

    headerRow: { flexDirection: 'row' },
    headerText: { flex: 1, gap: spacing.sm },
    name: { ...typography.display, color: colors.ink },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tierBadge: {
      backgroundColor: colors.accent,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    tierBadgeText: { ...typography.label, color: colors.accentInk },
    authBadge: {
      borderWidth: 1,
      borderColor: colors.good,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    authBadgeText: { ...typography.label, color: colors.good },

    ratingSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    ratingText: { ...typography.body, color: colors.muted },

    serviceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    serviceChip: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    serviceChipText: { ...typography.label, fontWeight: '600', color: colors.ink, letterSpacing: 0 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing.md,
      gap: spacing.sm,
    },
    addressLine: { ...typography.body, fontWeight: '600', color: colors.ink },
    addressSub: { ...typography.body, color: colors.muted },
    interstate: { ...typography.body, color: colors.accent, fontWeight: '600' },
    verified: { ...typography.label, fontWeight: '400', color: colors.muted, letterSpacing: 0 },

    actionRow: { flexDirection: 'row', gap: spacing.sm },
    actionBtn: {
      flex: 1,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    actionPrimary: { backgroundColor: colors.accent },
    actionPrimaryLabel: { ...typography.body, fontWeight: '700', color: colors.accentInk },
    actionSecondary: { borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.surface },
    actionSecondaryLabel: { ...typography.body, fontWeight: '600', color: colors.accent },

    sectionTitle: { ...typography.title, color: colors.ink },
    bodyText: { ...typography.body, color: colors.ink, lineHeight: typography.body.fontSize * 1.4 },
    phoneLink: { ...typography.body, color: colors.accent, fontWeight: '600', paddingVertical: spacing.xs },

    hoursRow: { flexDirection: 'row', justifyContent: 'space-between' },
    hoursDay: { ...typography.body, fontWeight: '600', color: colors.ink },
    hoursValue: { ...typography.body, color: colors.muted },

    amenityWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    amenityChip: {
      backgroundColor: colors.bg,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    amenityText: { ...typography.label, fontWeight: '400', color: colors.muted, letterSpacing: 0 },

    commentInput: {
      ...typography.body,
      color: colors.ink,
      backgroundColor: colors.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      borderRadius: radius.md,
      padding: spacing.md,
      minHeight: 72,
      textAlignVertical: 'top',
    },
    submitBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    submitLabel: { ...typography.body, fontWeight: '700', color: colors.accentInk },
    btnDisabled: { opacity: 0.5 },
    successText: { ...typography.body, color: colors.good, fontWeight: '600' },
    errorText: { ...typography.body, color: colors.danger },
    helperText: { ...typography.label, fontWeight: '400', color: colors.muted, letterSpacing: 0 },
    pendingText: { ...typography.label, fontWeight: '600', color: colors.safety, letterSpacing: 0 },

    repairBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.sm,
      borderLeftWidth: 4,
      borderLeftColor: colors.safety,
    },
    repairLabel: { ...typography.body, fontWeight: '800', color: colors.accentInk },
    pressed: { opacity: 0.85 },
  });
}
