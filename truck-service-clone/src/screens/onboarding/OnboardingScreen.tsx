/**
 * OnboardingScreen — first-run value-prop intro for the Auth stack.
 * ROLE: sells the app before asking for an account, then hands off to sign-in.
 * It is the entry route of AuthStack; once dismissed we persist
 * `StorageKeys.onboardingSeen` so returning signed-out users skip straight to
 * SignIn. Search is positioned as usable without an account ("Skip, search
 * first") — full guest browsing is auth-gated in this reference build, so the
 * skip affordance still lands on SignIn (see comment on handleSkip).
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/types';
import { useTheme, type Theme } from '@theme/index';
import { kvStorage, StorageKeys } from '@services/storage';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

const VALUE_PROPS: { icon: string; title: string; body: string }[] = [
  {
    icon: '🔧',
    title: 'Roadside help, 24/7',
    body: 'Mobile mechanics, towing, and tire service near your breakdown — searchable by interstate exit.',
  },
  {
    icon: '📍',
    title: 'Verified vendors nationwide',
    body: 'Repair shops, reefer specialists, dealers, and truck stops, filtered to what your rig needs right now.',
  },
  {
    icon: '🧾',
    title: 'Track the repair, not just the shop',
    body: 'Open a repair ticket, log costs and updates, and share it across your fleet until the truck rolls again.',
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme.scheme]);

  const markSeen = () => {
    // Fire-and-forget; a failed flag write just re-shows onboarding next launch.
    kvStorage.setJSON(StorageKeys.onboardingSeen, true).catch(() => undefined);
  };

  const handleContinue = () => {
    markSeen();
    navigation.navigate('SignIn');
  };

  const handleSkip = () => {
    // In production this drops into a guest SearchTab session; the tab app is
    // auth-gated in this reference scaffold, so we route to SignIn and let the
    // user browse once a session exists.
    markSeen();
    navigation.navigate('SignIn');
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <Text style={styles.mark}>🚚</Text>
          <Text style={styles.brand}>TruckFix Directory</Text>
        </View>

        <Text style={styles.headline}>Get back on the road faster</Text>
        <Text style={styles.subhead}>
          The heavy-duty service network drivers and dispatchers reach for when a truck goes down.
        </Text>

        <View style={styles.propList}>
          {VALUE_PROPS.map((p) => (
            <View key={p.title} style={styles.propCard}>
              <Text style={styles.propIcon}>{p.icon}</Text>
              <View style={styles.propText}>
                <Text style={styles.propTitle}>{p.title}</Text>
                <Text style={styles.propBody}>{p.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={handleContinue}
        >
          <Text style={styles.primaryLabel}>Continue</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipLabel}>Skip, search first</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  const { colors, spacing, radius, typography } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingTop: spacing.xl * 2, gap: spacing.md },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    mark: { fontSize: 28 },
    brand: { ...typography.label, color: colors.accent, fontSize: typography.body.fontSize },
    headline: { ...typography.display, color: colors.ink, marginTop: spacing.md },
    subhead: {
      ...typography.body,
      color: colors.muted,
      lineHeight: typography.body.fontSize * 1.4,
    },
    propList: { marginTop: spacing.lg, gap: spacing.md },
    propCard: {
      flexDirection: 'row',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing.md,
    },
    propIcon: { fontSize: 26 },
    propText: { flex: 1, gap: spacing.xs },
    propTitle: { ...typography.body, fontWeight: '700', color: colors.ink },
    propBody: {
      ...typography.body,
      color: colors.muted,
      lineHeight: typography.body.fontSize * 1.4,
    },
    footer: {
      padding: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
      gap: spacing.sm,
      backgroundColor: colors.bg,
    },
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    primaryLabel: { ...typography.body, fontWeight: '700', color: colors.accentInk },
    skipBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
    skipLabel: { ...typography.body, fontWeight: '600', color: colors.accent },
    pressed: { opacity: 0.85 },
  });
}
