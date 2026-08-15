/**
 * SignInScreen — email/password sign-in for the Auth stack.
 * ROLE: exchanges credentials for a session via useAuth().signIn (which drives
 * authStore.status -> 'signedIn', flipping RootNavigator to the tab app).
 * NOTE: browsing the directory works signed-out in the production app; the
 * sync-backed features (ratings, private rates, saved locations, repair
 * tickets) require an account, which is why those surfaces route here.
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
import { useTheme, type Theme } from '@theme/index';
import { useAuth } from '@hooks/useAuth';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme.scheme]);
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !submitting;

  const handleSignIn = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      // No manual navigation: RootNavigator swaps to the tab app on status change.
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Could not sign in. Check your email and password and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to rate shops, track repairs, and sync across your fleet.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="driver@fleet.com"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={theme.colors.muted}
            secureTextEntry
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleSignIn}
          />
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
          onPress={handleSignIn}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.accentInk} />
          ) : (
            <Text style={styles.primaryLabel}>Sign in</Text>
          )}
        </Pressable>

        <View style={styles.registerRow}>
          <Text style={styles.registerHint}>New to TruckFix Directory?</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>Create an account</Text>
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
    registerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.lg,
    },
    registerHint: { ...typography.body, color: colors.muted },
    registerLink: { ...typography.body, fontWeight: '700', color: colors.accent },
    pressed: { opacity: 0.85 },
  });
}
