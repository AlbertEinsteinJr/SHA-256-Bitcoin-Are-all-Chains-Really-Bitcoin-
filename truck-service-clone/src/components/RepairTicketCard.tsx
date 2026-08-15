/**
 * RepairTicketCard — one row in the fleet's list of active/closed breakdown tickets.
 * ROLE: presentational summary of a `RepairTicket` (the "Start Repair" workflow object).
 * It renders the status as a color-coded pill following the app's safety semantics —
 * amber (colors.safety) while a truck is en route / being worked, green when completed,
 * red when cancelled — plus truck id, running total cost, and last-updated time.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@theme/index';
import type { RepairTicket, RepairStatus } from '@models/index';

const STATUS_LABEL: Record<RepairStatus, string> = {
  open: 'Open',
  vendor_contacted: 'Vendor Contacted',
  en_route: 'En Route',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * Map a status to its pill color. Active-response states (en_route/in_progress)
 * are amber to read as "in motion"; completed is green, cancelled is red, and the
 * early states stay on the neutral navy accent.
 */
function statusColor(status: RepairStatus, colors: ReturnType<typeof useTheme>['colors']): string {
  switch (status) {
    case 'en_route':
    case 'in_progress':
      return colors.safety;
    case 'completed':
      return colors.good;
    case 'cancelled':
      return colors.danger;
    default:
      return colors.accent;
  }
}

/** Compact relative-time label for the "updated" line. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function RepairTicketCard({
  ticket,
  onPress,
}: {
  ticket: RepairTicket;
  onPress: () => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const pill = statusColor(ticket.status, colors);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Repair ticket ${ticket.title}, ${STATUS_LABEL[ticket.status]}`}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderWidth: StyleSheet.hairlineWidth,
        borderLeftColor: pill,
        borderLeftWidth: 4,
        borderRadius: radius.md,
        padding: spacing.lg,
        marginHorizontal: spacing.lg,
        marginVertical: spacing.sm,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={styles.rowBetween}>
        <Text
          numberOfLines={1}
          style={[typography.title, { color: colors.ink, flex: 1, marginRight: spacing.sm }]}
        >
          {ticket.title}
        </Text>
        {/* Status pill */}
        <View
          style={{
            backgroundColor: pill,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
          }}
        >
          <Text style={[typography.label, { color: colors.accentInk }]}>
            {STATUS_LABEL[ticket.status].toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
        <Text style={[typography.body, { color: colors.muted }]}>
          {ticket.truckId ? `Unit ${ticket.truckId}` : 'Unassigned unit'}
          {ticket.pendingSync ? '  ·  ⟳ pending sync' : ''}
        </Text>
        <Text style={[typography.title, { color: colors.ink, fontSize: 16 }]}>
          ${ticket.totalCost.toFixed(2)}
        </Text>
      </View>

      <Text style={[typography.label, { color: colors.muted, marginTop: spacing.xs }]}>
        {ticket.updates.length} update{ticket.updates.length === 1 ? '' : 's'} · updated{' '}
        {timeAgo(ticket.updatedAt)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
