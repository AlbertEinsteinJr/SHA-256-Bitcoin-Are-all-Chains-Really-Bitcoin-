/**
 * SavedScreen (SavedTab) — the user's account-scoped collections.
 * Gated behind auth (saving is a sync feature): signed-out users get a sign-in
 * prompt that bounces to the Auth stack via the root navigator. Signed-in users
 * get a segmented control over two GET-backed lists — Favorites (shared directory
 * vendors they starred) and Private locations (their own yards/drop lots) — both
 * rendered with the shared VendorCard.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { AppTabsParamList } from '@/navigation/types';
import { VendorSchema, type Vendor } from '@models/index';
import { VendorCard } from '@components/VendorCard';
import { apiGet } from '@services/apiClient';
import { endpoints } from '@config/endpoints';
import { useAuth } from '@hooks/useAuth';
import { useTheme, type Theme } from '@theme/index';

type Segment = 'favorites' | 'locations';
const VendorListSchema = z.object({ items: z.array(VendorSchema) });

type Props = BottomTabScreenProps<AppTabsParamList, 'SavedTab'>;

export default function SavedScreen({ navigation }: Props) {
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { status } = useAuth();
  const [segment, setSegment] = useState<Segment>('favorites');

  const path = segment === 'favorites' ? endpoints.favorites : endpoints.privateLocations;
  const query = useQuery({
    queryKey: ['saved', segment],
    queryFn: () => apiGet(path, VendorListSchema).then((r) => r.items),
    enabled: status === 'signedIn',
  });

  const openVendor = (vendor: Vendor) =>
    navigation.navigate('SearchTab', {
      screen: 'VendorDetail',
      params: { vendorId: vendor.id },
    });

  if (status !== 'signedIn') {
    return (
      <View style={s.gate}>
        <Text style={s.gateIcon}>★</Text>
        <Text style={s.gateTitle}>Save your go-to shops</Text>
        <Text style={s.gateBody}>
          Sign in to keep favorites and private yard locations in sync across every
          truck and dispatcher on your account.
        </Text>
        <Pressable style={s.primaryBtn} onPress={() => navigation.getParent()?.navigate('Auth')}>
          <Text style={s.primaryBtnText}>Sign in or create account</Text>
        </Pressable>
      </View>
    );
  }

  const vendors = query.data ?? [];

  return (
    <View style={s.root}>
      <View style={s.segmentBar}>
        <Segmented label="Favorites" active={segment === 'favorites'} onPress={() => setSegment('favorites')} theme={theme} />
        <Segmented label="Private locations" active={segment === 'locations'} onPress={() => setSegment('locations')} theme={theme} />
      </View>

      {query.isLoading ? (
        <ActivityIndicator style={s.loader} color={theme.colors.accent} />
      ) : (
        <FlatList
          data={vendors}
          keyExtractor={(v) => v.id}
          contentContainerStyle={s.listContent}
          refreshing={query.isFetching}
          onRefresh={query.refetch}
          renderItem={({ item }) => <VendorCard vendor={item} onPress={() => openVendor(item)} />}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>
                {segment === 'favorites' ? 'No favorites yet' : 'No private locations yet'}
              </Text>
              <Text style={s.emptyBody}>
                {segment === 'favorites'
                  ? 'Tap the star on any vendor to pin it here.'
                  : 'Add your terminals and drop yards from a vendor detail screen.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function Segmented({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  const { colors, radius, spacing } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderRadius: radius.md,
        backgroundColor: active ? colors.accent : 'transparent',
      }}
    >
      <Text style={{ color: active ? colors.accentInk : colors.muted, fontWeight: '700', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(t: Theme) {
  const { colors, spacing, radius } = t;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    segmentBar: {
      flexDirection: 'row',
      gap: spacing.xs,
      margin: spacing.lg,
      padding: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
    },
    loader: { marginTop: spacing.xxl },
    listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    empty: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.sm },
    emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
    emptyBody: { color: colors.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.xl },
    gate: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.md,
    },
    gateIcon: { fontSize: 40, color: colors.safety },
    gateTitle: { fontSize: 22, fontWeight: '800', color: colors.ink },
    gateBody: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
    primaryBtn: {
      marginTop: spacing.md,
      backgroundColor: colors.accent,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
    },
    primaryBtnText: { color: colors.accentInk, fontWeight: '700', fontSize: 15 },
  });
}
