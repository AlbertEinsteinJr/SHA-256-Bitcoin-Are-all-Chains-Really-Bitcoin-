/**
 * RepairTicketScreen (Repairs 'RepairTicket') — the single breakdown's detail.
 *
 * A RepairTicket is a SHARED FLEET ARTIFACT: it is not owned by one device.
 * Every driver, dispatcher, and fleet manager on the account appends to the same
 * event log (ticket.updates), and sync merges those concurrent edits. This screen
 * therefore reads the ticket via useRepair() and appends new entries through
 * repairRepository.addUpdate() (optimistic local write + background sync) rather
 * than mutating the ticket object in place.
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
import type { RepairsStackParamList } from '@/navigation/types';
import type { RepairStatus, RepairUpdate } from '@models/index';
import { useRepair } from '@hooks/useRepairs';
import { repairRepository } from '@/data/repositories/repairRepository';
import { useAuth } from '@hooks/useAuth';
import { useTheme, type Theme } from '@theme/index';

const STATUS_LABEL: Record<RepairStatus, string> = {
  open: 'Open',
  vendor_contacted: 'Vendor contacted',
  en_route: 'En route',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_FLOW: RepairStatus[] = [
  'open',
  'vendor_contacted',
  'en_route',
  'in_progress',
  'completed',
  'cancelled',
];

type Props = NativeStackScreenProps<RepairsStackParamList, 'RepairTicket'>;

export default function RepairTicketScreen({ route }: Props) {
  const { ticketId } = route.params;
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { user } = useAuth();

  const { data: ticket, isLoading, refetch } = useRepair(ticketId);

  const [note, setNote] = useState('');
  const [costDelta, setCostDelta] = useState('');
  const [nextStatus, setNextStatus] = useState<RepairStatus | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const statusColor = (status: RepairStatus) =>
    status === 'en_route' || status === 'in_progress'
      ? theme.colors.safety
      : status === 'completed'
      ? theme.colors.good
      : status === 'cancelled'
      ? theme.colors.danger
      : theme.colors.accent;

  const addUpdate = async () => {
    if (!ticket) return;
    const parsedCost = costDelta.trim() ? Number(costDelta) : undefined;
    if (!note.trim() && nextStatus === undefined && parsedCost === undefined) return;

    setSaving(true);
    try {
      // Append-only: the author stamp is what lets sync attribute concurrent
      // fleet edits without conflict.
      await repairRepository.addUpdate(ticket.id, {
        authorId: user?.id ?? 'me',
        authorName: user?.displayName ?? user?.email ?? 'You',
        status: nextStatus,
        note: note.trim() || undefined,
        costDelta: Number.isFinite(parsedCost) ? parsedCost : undefined,
      });
      setNote('');
      setCostDelta('');
      setNextStatus(undefined);
      await refetch();
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <ActivityIndicator style={s.loader} color={theme.colors.accent} />;
  if (!ticket) {
    return (
      <View style={s.loader}>
        <Text style={s.notFound}>This ticket is no longer available.</Text>
      </View>
    );
  }

  const timeline = [...ticket.updates].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {/* Header summary */}
      <View style={s.header}>
        <View style={[s.statusPill, { backgroundColor: statusColor(ticket.status) }]}>
          <Text style={s.statusPillText}>{STATUS_LABEL[ticket.status]}</Text>
        </View>
        {ticket.pendingSync ? <Text style={s.pending}>· syncing</Text> : null}
      </View>
      <Text style={s.title}>{ticket.title}</Text>
      <View style={s.metaRow}>
        {ticket.truckId ? <Text style={s.meta}>Unit {ticket.truckId}</Text> : null}
        {ticket.fleetId ? <Text style={s.meta}>Fleet shared</Text> : <Text style={s.meta}>Personal</Text>}
        <Text style={s.meta}>${ticket.totalCost.toFixed(2)}</Text>
      </View>
      {ticket.breakdownLocation ? (
        <Text style={s.location}>📍 {ticket.breakdownLocation}</Text>
      ) : null}

      {/* Add-update composer */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Add an update</Text>
        <TextInput
          placeholder="Note for the team (e.g. tech on site, waiting on part)"
          placeholderTextColor={theme.colors.muted}
          value={note}
          onChangeText={setNote}
          multiline
          style={s.noteInput}
        />
        <View style={s.costRow}>
          <Text style={s.costLabel}>Cost added ($)</Text>
          <TextInput
            placeholder="0.00"
            placeholderTextColor={theme.colors.muted}
            value={costDelta}
            onChangeText={setCostDelta}
            keyboardType="decimal-pad"
            style={s.costInput}
          />
        </View>

        <Text style={s.costLabel}>Move status to</Text>
        <View style={s.statusChoices}>
          {STATUS_FLOW.map((st) => {
            const active = nextStatus === st;
            return (
              <Pressable
                key={st}
                onPress={() => setNextStatus(active ? undefined : st)}
                style={[
                  s.statusChoice,
                  { borderColor: active ? statusColor(st) : theme.colors.line },
                  active && { backgroundColor: statusColor(st) },
                ]}
              >
                <Text
                  style={{
                    color: active ? theme.colors.accentInk : theme.colors.muted,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {STATUS_LABEL[st]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={[s.postBtn, saving && { opacity: 0.6 }]} onPress={addUpdate} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={theme.colors.accentInk} />
          ) : (
            <Text style={s.postBtnText}>Post update</Text>
          )}
        </Pressable>
      </View>

      {/* Event timeline */}
      <Text style={s.timelineHeading}>Activity</Text>
      {timeline.length === 0 ? (
        <Text style={s.meta}>No updates yet.</Text>
      ) : (
        timeline.map((u) => <TimelineRow key={u.id} update={u} theme={theme} color={u.status ? statusColor(u.status) : theme.colors.line} />)
      )}
    </ScrollView>
  );
}

function TimelineRow({ update, theme, color }: { update: RepairUpdate; theme: Theme; color: string }) {
  const { colors, spacing } = theme;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginTop: 5 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 13 }}>
          {update.authorName}
          {update.status ? ` · ${STATUS_LABEL[update.status]}` : ''}
        </Text>
        {update.note ? (
          <Text style={{ color: colors.ink, fontSize: 14, marginTop: 2 }}>{update.note}</Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 2 }}>
          {typeof update.costDelta === 'number' && update.costDelta !== 0 ? (
            <Text style={{ color: colors.good, fontSize: 12, fontWeight: '600' }}>
              {update.costDelta > 0 ? '+' : ''}${update.costDelta.toFixed(2)}
            </Text>
          ) : null}
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {new Date(update.createdAt).toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(t: Theme) {
  const { colors, spacing, radius } = t;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, gap: spacing.sm },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xxl },
    notFound: { color: colors.muted, fontSize: 15 },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    statusPill: { borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
    statusPillText: { color: colors.accentInk, fontSize: 12, fontWeight: '800' },
    pending: { color: colors.safety, fontSize: 12, fontWeight: '600' },
    title: { fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: spacing.xs },
    metaRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
    meta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
    location: { color: colors.ink, fontSize: 14, marginTop: spacing.xs },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing.md,
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
    noteInput: {
      backgroundColor: colors.bg,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing.md,
      color: colors.ink,
      fontSize: 14,
      minHeight: 64,
      textAlignVertical: 'top',
    },
    costRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    costLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
    costInput: {
      backgroundColor: colors.bg,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.ink,
      fontSize: 14,
      minWidth: 110,
      textAlign: 'right',
    },
    statusChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    statusChoice: {
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    postBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    postBtnText: { color: colors.accentInk, fontWeight: '700', fontSize: 15 },
    timelineHeading: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: spacing.lg },
  });
}
