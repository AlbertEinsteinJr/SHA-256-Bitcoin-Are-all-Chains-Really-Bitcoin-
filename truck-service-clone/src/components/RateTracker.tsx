/**
 * RateTracker — the inline editor for a driver's private, per-vendor pricing notes.
 * ROLE: presentational form over the money fields of a `Rate` (labor, after-hours,
 * service-call fee). It holds local text state, coerces to numbers on save, and emits
 * a `Partial<Rate>` patch upward — persistence, ownerId, and sync flags belong to the
 * repository layer, never here. Rates are private and never shared with the vendor.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@theme/index';
import type { Rate } from '@models/index';

/** Turn a currency text field into a number or undefined (blank = "not tracked"). */
function toAmount(raw: string): number | undefined {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (cleaned === '') return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function RateTracker({
  rate,
  onSave,
}: {
  rate?: Rate;
  onSave: (patch: Partial<Rate>) => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();

  const [labor, setLabor] = useState(rate?.laborHourly?.toString() ?? '');
  const [afterHours, setAfterHours] = useState(rate?.afterHoursHourly?.toString() ?? '');
  const [serviceCall, setServiceCall] = useState(rate?.serviceCallFee?.toString() ?? '');

  const handleSave = () => {
    onSave({
      laborHourly: toAmount(labor),
      afterHoursHourly: toAmount(afterHours),
      serviceCallFee: toAmount(serviceCall),
    });
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.md,
        padding: spacing.lg,
      }}
    >
      <Text style={[typography.title, { color: colors.ink }]}>Your rate notes</Text>
      <Text style={[typography.body, { color: colors.muted, marginTop: 2 }]}>
        Private to you — track what this shop charges so you can compare on the next
        breakdown.
      </Text>

      <Field
        label="Labor / hour"
        value={labor}
        onChangeText={setLabor}
        placeholder="e.g. 145"
      />
      <Field
        label="After-hours / hour"
        value={afterHours}
        onChangeText={setAfterHours}
        placeholder="e.g. 210"
      />
      <Field
        label="Service-call fee"
        value={serviceCall}
        onChangeText={setServiceCall}
        placeholder="e.g. 125"
      />

      <Pressable
        onPress={handleSave}
        accessibilityRole="button"
        style={({ pressed }) => ({
          backgroundColor: colors.accent,
          borderRadius: radius.sm,
          paddingVertical: spacing.md,
          alignItems: 'center',
          marginTop: spacing.lg,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={[typography.label, { color: colors.accentInk }]}>
          {rate ? 'UPDATE RATES' : 'SAVE RATES'}
        </Text>
      </Pressable>
    </View>
  );
}

/** One labeled currency input row. */
function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={[typography.label, { color: colors.muted, marginBottom: spacing.xs }]}>
        {label.toUpperCase()}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderColor: colors.line,
          borderWidth: 1,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.bg,
        }}
      >
        <Text style={[typography.body, { color: colors.muted }]}>$</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          style={[
            typography.body,
            { color: colors.ink, flex: 1, paddingVertical: spacing.md, marginLeft: spacing.xs },
          ]}
        />
      </View>
    </View>
  );
}
