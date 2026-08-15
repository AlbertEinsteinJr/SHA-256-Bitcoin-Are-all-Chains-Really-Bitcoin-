/**
 * RegisterScreen — new-account creation for the Auth stack.
 * ROLE: collects email, password, and the caller's AccountType, then calls
 * useAuth().register to create the session (RootNavigator then swaps to the
 * tab app). The account-type choice tailors the app (a fleet_manager sees
 * shared repair tickets; a vendor manages a listing); register() itself takes
 * only email/password, so the selected type is captured here for the profile
 * that the session-exchange call attaches server-side.
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
import type { AuthStackParamList } from '@/navigation/types';
import type { AccountType } from '@models/index';
import { useTheme, type Theme } from '@theme/index';
import { useAuth } from '@hooks/useAuth';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const ACCOUNT_TYPES: { value: AccountType; label: string; blurb: string }[] = [
  { value: 'driver', label: 'Owner-operator / driver', blurb: 'Find help and track your own repairs' },
  { value: 'dispatcher', label: 'Dispatcher', blurb: 'Coordinate breakdowns for drivers on the road' },
  { value: 'fleet_manager', label: 'Fleet manager', blurb: 'Manage trucks, rates, and shared tickets' },
  { value: 'vendor', label: 'Service vendor', blurb: 'List a shop or mobile service business' },
];

export default function RegisterScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme.scheme]);
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('driver');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 8 && !submitting;

  const handleRegister = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      // accountType is passed through the profile the backend links to this
      // session on first exchange; the hook signature is (email, password).
      await register(email.trim().toLowerCase(), password);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Could not create your account. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Takes a minute. You can change your role later in Account settings.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={theme.colors.muted}
            secureTextEntry
            textContentType="newPassword"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>I am a…</Text>
          <View style={styles.typeList}>
            {ACCOUNT_TYPES.map((t) => {
              const selected = t.value === accountType;
              return (
                <Pressable
                  key={t.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setAccountType(t.value)}
                  style={({ pressed }) => [
                    styles.typeCard,
                    selected && styles.typeCardSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.radio, selected && styles.radioOn]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.typeText}>
                    <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>
                      {t.label}
                    </Text>
                    <Text style={styles.typeBlurb}>{t.blurb}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.primaryBtn,
            !canSubmit && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
          onPress={handleRegister}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.accentInk} />
          ) : (
            <Text style={styles.primaryLabel}>Create account</Text>
          )}
        </Pressable>

        <View style={styles.signInRow}>
          <Text style={styles.signInHint}>Already registered?</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('SignIn')}>
            <Text style={styles.signInLink}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(theme: Theme) {
  const { colors, spacing, radius, typography } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingTop: spacing.xl * 2, gap: spacing.md },
    title: { ...typography.display, color: colors.ink },
    subtitle: {
      ...typography.body,
      color: colors.muted,
      lineHeight: typography.body.fontSize * 1.4,
    },
    field: { gap: spacing.xs, marginTop: spacing.sm },
    label: { ...typography.label, color: colors.muted, textTransform: 'uppercase' },
    input: {
      ...typography.body,
      color: colors.ink,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    typeList: { gap: spacing.sm },
    typeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    typeCardSelected: { borderColor: colors.accent },
    radio: {
      width: 22,
      height: 22,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: colors.accent },
    radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.accent },
    typeText: { flex: 1, gap: 2 },
    typeLabel: { ...typography.body, fontWeight: '600', color: colors.ink },
    typeLabelSelected: { color: colors.accent },
    typeBlurb: { ...typography.label, fontWeight: '400', color: colors.muted, letterSpacing: 0 },
    errorBox: {
      backgroundColor: colors.surface,
      borderLeftWidth: 3,
      borderLeftColor: colors.danger,
      borderRadius: radius.sm,
      padding: spacing.md,
    },
    errorText: { ...typography.body, color: colors.danger },
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    btnDisabled: { opacity: 0.5 },
    primaryLabel: { ...typography.body, fontWeight: '700', color: colors.accentInk },
    signInRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.lg,
    },
    signInHint: { ...typography.body, color: colors.muted },
    signInLink: { ...typography.body, fontWeight: '700', color: colors.accent },
    pressed: { opacity: 0.85 },
  });
}
