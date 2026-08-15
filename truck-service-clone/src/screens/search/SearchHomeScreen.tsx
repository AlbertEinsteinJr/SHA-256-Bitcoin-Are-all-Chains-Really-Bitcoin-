/**
 * SearchHomeScreen — the Search tab's landing surface.
 * ROLE: the "what do you need, and where are you" entry point. Resolves the
 * driver's location (useLocation), loads the service taxonomy from the
 * vendorRepository via react-query, and routes a chosen category — or a typed
 * query — into the Results list. Server state (categories) lives in react-query;
 * the live geo filter lives in searchStore, which useLocation() seeds.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SearchStackParamList } from '@/navigation/types';
import type { Category, ServiceType } from '@models/index';
import { useTheme, type Theme } from '@theme/index';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@store/queryClient';
import { vendorRepository } from '@/data/repositories/vendorRepository';
import { useLocation } from '@hooks/useLocation';
import { CategoryGrid } from '@components/CategoryGrid';

type Props = NativeStackScreenProps<SearchStackParamList, 'SearchHome'>;

export default function SearchHomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme.scheme]);
  const { coordinate, loading: locating, error: locError, refresh } = useLocation();
  const [term, setTerm] = useState('');

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => vendorRepository.getCategories(),
  });

  const categories: Category[] = categoriesQuery.data ?? [];

  // Client-side quick filter over the taxonomy — narrows the grid as you type.
  const visible = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) => c.label.toLowerCase().includes(q) || c.serviceType.replace('_', ' ').includes(q)
    );
  }, [term, categories]);

  const titleFor = (type: ServiceType) =>
    categories.find((c) => c.serviceType === type)?.label ?? 'Nearby service';

  const openResults = (serviceType: ServiceType) => {
    navigation.navigate('Results', { serviceTypes: [serviceType], title: titleFor(serviceType) });
  };

  const submitSearch = () => {
    const q = term.trim();
    if (!q) return;
    // If the text matches known categories, scope Results to them; otherwise
    // fall through to an all-categories nearby search titled by the query.
    const matchedTypes = visible.map((c) => c.serviceType);
    navigation.navigate('Results', {
      serviceTypes: matchedTypes.length ? matchedTypes : undefined,
      title: matchedTypes.length ? `“${q}”` : `“${q}” nearby`,
    });
  };

  const locationLabel = coordinate
    ? `Using your location (${coordinate.latitude.toFixed(2)}, ${coordinate.longitude.toFixed(2)})`
    : locError ?? 'Location off — showing a default radius';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Find truck service</Text>
        <Text style={styles.subtitle}>Search mobile repair, towing, tire, and more near your breakdown.</Text>

        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={term}
            onChangeText={setTerm}
            placeholder="Search a service (e.g. tire, reefer, towing)"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={submitSearch}
          />
          {term.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => setTerm('')} hitSlop={8}>
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={refresh}
          disabled={locating}
          style={({ pressed }) => [styles.locationBtn, pressed && styles.pressed]}
        >
          {locating ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <Text style={styles.locationBtnLabel}>📍 Use my location</Text>
          )}
        </Pressable>
        <Text style={[styles.locationHint, locError ? styles.locationError : null]}>{locationLabel}</Text>

        <Text style={styles.sectionTitle}>Browse categories</Text>

        {categoriesQuery.isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.centerText}>Loading services…</Text>
          </View>
        ) : categoriesQuery.isError ? (
          <View style={styles.centerBox}>
            <Text style={styles.centerText}>Couldn’t load categories.</Text>
            <Pressable accessibilityRole="button" onPress={() => categoriesQuery.refetch()}>
              <Text style={styles.retryLink}>Retry</Text>
            </Pressable>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.centerText}>No categories match “{term.trim()}”.</Text>
          </View>
        ) : (
          <CategoryGrid categories={visible} onSelect={openResults} />
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(theme: Theme) {
  const { colors, spacing, radius, typography } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, gap: spacing.md },
    title: { ...typography.title, color: colors.ink },
    subtitle: {
      ...typography.body,
      color: colors.muted,
      lineHeight: typography.body.fontSize * 1.4,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    searchIcon: { fontSize: 16 },
    searchInput: { ...typography.body, flex: 1, color: colors.ink, paddingVertical: spacing.md },
    clearIcon: { ...typography.body, color: colors.muted },
    locationBtn: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
    },
    locationBtnLabel: { ...typography.body, fontWeight: '600', color: colors.accent },
    locationHint: { ...typography.label, fontWeight: '400', color: colors.muted, letterSpacing: 0 },
    locationError: { color: colors.danger },
    sectionTitle: { ...typography.title, color: colors.ink, marginTop: spacing.md },
    centerBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    centerText: { ...typography.body, color: colors.muted },
    retryLink: { ...typography.body, fontWeight: '700', color: colors.accent },
    pressed: { opacity: 0.85 },
  });
}
