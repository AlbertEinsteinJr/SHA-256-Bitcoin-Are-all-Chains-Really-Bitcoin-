/**
 * RepairsListScreen (Repairs 'RepairsList') — the roster of breakdown tickets.
 * Reads the offline-first ticket list via useRepairs() (react-query over the
 * SQLite-backed repairRepository) and renders each as a RepairTicketCard. The
 * header "New" action and the empty-state CTA both open StartRepair; tapping a
 * card drills into the shared RepairTicket detail.
 */
import React, { useLayoutEffect, useMemo } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RepairsStackParamList } from '@/navigation/types';
import { RepairTicketCard } from '@components/RepairTicketCard';
import { useRepairs } from '@hooks/useRepairs';
import { useTheme, type Theme } from '@theme/index';

type Props = NativeStackScreenProps<RepairsStackParamList, 'RepairsList'>;

export default function RepairsListScreen({ navigation }: Props) {
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { data: tickets, isLoading, isFetching, refetch } = useRepairs();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('StartRepair')}
          hitSlop={8}
          style={{ paddingHorizontal: theme.spacing.sm }}
        >
          <Text style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 15 }}>+ New</Text>
        </Pressable>
      ),
    });
  }, [navigation, theme]);

  if (isLoading) {
    return <ActivityIndicator style={s.loader} color={theme.colors.accent} />;
  }

  const data = tickets ?? [];

  return (
    <View style={s.root}>
      <FlatList
        data={data}
        keyExtractor={(t) => t.id}
        contentContainerStyle={s.listContent}
        refreshing={isFetching}
        onRefresh={refetch}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
        renderItem={({ item }) => (
          <RepairTicketCard
            ticket={item}
            onPress={() => navigation.navigate('RepairTicket', { ticketId: item.id })}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🔧</Text>
            <Text style={s.emptyTitle}>No active repairs</Text>
            <Text style={s.emptyBody}>
              Start a ticket when a truck breaks down to track status, costs, and
              vendor notes with your whole team.
            </Text>
            <Pressable style={s.primaryBtn} onPress={() => navigation.navigate('StartRepair')}>
              <Text style={s.primaryBtnText}>Start a repair</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

function createStyles(t: Theme) {
  const { colors, spacing, radius } = t;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    loader: { flex: 1, marginTop: spacing.xxl },
    listContent: { padding: spacing.lg, flexGrow: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.xxl },
    emptyIcon: { fontSize: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
    emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 21, paddingHorizontal: spacing.xl },
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
