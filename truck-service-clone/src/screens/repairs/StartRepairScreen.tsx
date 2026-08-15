/**
 * StartRepairScreen (Repairs 'StartRepair') — the ticket-creation form.
 * Captures the breakdown essentials (what failed, which truck, where) plus an
 * optional pre-filled vendorId when launched from a vendor's "Start a repair here"
 * action. Submits through useCreateRepair() (optimistic write to the local queue,
 * then background sync) and replaces itself with the new RepairTicket so Back
 * returns to the list, not the empty form.
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
import { useCreateRepair } from '@hooks/useRepairs';
import { useTheme, type Theme } from '@theme/index';

type Props = NativeStackScreenProps<RepairsStackParamList, 'StartRepair'>;

export default function StartRepairScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const vendorId = route.params?.vendorId;

  const createRepair = useCreateRepair();
  const [title, setTitle] = useState('');
  const [truckId, setTruckId] = useState('');
  const [breakdownLocation, setBreakdownLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError('Describe the problem so your team knows what they are dealing with.');
      return;
    }
    setError(null);
    try {
      const ticket = await createRepair.mutateAsync({
        title: title.trim(),
        truckId: truckId.trim() || undefined,
        breakdownLocation: breakdownLocation.trim() || undefined,
        vendorId,
      });
      navigation.replace('RepairTicket', { ticketId: ticket.id });
    } catch (e) {
      setError('Could not save the ticket. It will be queued and retried when back online.');
    }
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>New repair ticket</Text>
      <Text style={s.subheading}>
        Log the breakdown now — status, costs, and vendor notes stay in sync for the
        whole fleet.
      </Text>

      {vendorId ? (
        <View style={s.vendorChip}>
          <Text style={s.vendorChipText}>Vendor pre-selected from directory</Text>
        </View>
      ) : null}

      <Field
        theme={theme}
        label="What failed?"
        placeholder="e.g. Coolant leak, blown steer tire, DEF derate"
        value={title}
        onChangeText={setTitle}
        multiline
      />
      <Field
        theme={theme}
        label="Truck / unit number"
        placeholder="e.g. Unit 4471"
        value={truckId}
        onChangeText={setTruckId}
        autoCapitalize="characters"
      />
      <Field
        theme={theme}
        label="Breakdown location"
        placeholder="e.g. I-80 WB, MM 284, near Grand Island NE"
        value={breakdownLocation}
        onChangeText={setBreakdownLocation}
      />

      {error ? <Text style={s.error}>{error}</Text> : null}

      <Pressable
        style={[s.primaryBtn, createRepair.isPending && s.primaryBtnDisabled]}
        onPress={submit}
        disabled={createRepair.isPending}
      >
        {createRepair.isPending ? (
          <ActivityIndicator color={theme.colors.accentInk} />
        ) : (
          <Text style={s.primaryBtnText}>Open ticket</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Field({
  theme,
  label,
  ...input
}: { theme: Theme; label: string } & React.ComponentProps<typeof TextInput>) {
  const { colors, spacing, radius } = theme;
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 }}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.line,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: colors.ink,
          fontSize: 15,
          minHeight: input.multiline ? 72 : undefined,
          textAlignVertical: input.multiline ? 'top' : 'center',
        }}
        {...input}
      />
    </View>
  );
}

function createStyles(t: Theme) {
  const { colors, spacing, radius } = t;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, gap: spacing.lg },
    heading: { fontSize: 24, fontWeight: '800', color: colors.ink },
    subheading: { fontSize: 14, color: colors.muted, lineHeight: 21, marginTop: -spacing.sm },
    vendorChip: {
      alignSelf: 'flex-start',
      backgroundColor: colors.good,
      borderRadius: radius.pill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    vendorChipText: { color: colors.accentInk, fontSize: 12, fontWeight: '700' },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: colors.accentInk, fontWeight: '700', fontSize: 16 },
  });
}
