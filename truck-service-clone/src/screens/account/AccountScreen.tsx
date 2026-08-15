/**
 * AccountScreen (AccountTab) — profile + app settings hub.
 * Surfaces the signed-in user's identity/account type, a couple of client-only
 * preference toggles (units, push notifications), and two account actions:
 * "Send feedback" reaches the root-level Feedback modal via getParent() (it lives
 * outside the tab navigator), and "Sign out" clears the session through useAuth().
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Switch, ScrollView, StyleSheet } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { AppTabsParamList } from '@/navigation/types';
import type { AccountType } from '@models/index';
import { useAuth } from '@hooks/useAuth';
import { useTheme, type Theme } from '@theme/index';

const ACCOUNT_LABEL: Record<AccountType, string> = {
  driver: 'Driver',
  dispatcher: 'Dispatcher',
  fleet_manager: 'Fleet manager',
  vendor: 'Service vendor',
};

type Props = BottomTabScreenProps<AppTabsParamList, 'AccountTab'>;

export default function AccountScreen({ navigation }: Props) {
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { user, signOut } = useAuth();

  // Client-side prefs; a real build would persist these via kvStorage.
  const [useMetric, setUseMetric] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);

  const displayName = user?.displayName ?? user?.email ?? 'Guest';
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.profile}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{displayName}</Text>
          {user?.email ? <Text style={s.email}>{user.email}</Text> : null}
          {user ? (
            <View style={s.typeBadge}>
              <Text style={s.typeBadgeText}>{ACCOUNT_LABEL[user.accountType]}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={s.sectionLabel}>PREFERENCES</Text>
      <View style={s.card}>
        <ToggleRow
          theme={theme}
          title="Distances in kilometers"
          subtitle="Show miles when off"
          value={useMetric}
          onValueChange={setUseMetric}
        />
        <View style={s.divider} />
        <ToggleRow
          theme={theme}
          title="Repair push notifications"
          subtitle="Alert me when a teammate updates a ticket"
          value={pushEnabled}
          onValueChange={setPushEnabled}
        />
      </View>

      <Text style={s.sectionLabel}>SUPPORT</Text>
      <View style={s.card}>
        <ActionRow
          theme={theme}
          title="Send feedback"
          subtitle="Report a wrong listing or suggest a feature"
          onPress={() => navigation.getParent()?.navigate('Feedback')}
        />
      </View>

      <Pressable style={s.signOutBtn} onPress={() => signOut()}>
        <Text style={s.signOutText}>Sign out</Text>
      </Pressable>

      <Text style={s.version}>Truck Service Directory · v1.0.0</Text>
    </ScrollView>
  );
}

function ToggleRow({
  theme,
  title,
  subtitle,
  value,
  onValueChange,
}: {
  theme: Theme;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { colors, spacing } = theme;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm }}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accent, false: colors.line }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

function ActionRow({
  theme,
  title,
  subtitle,
  onPress,
}: {
  theme: Theme;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors, spacing } = theme;
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 20 }}>›</Text>
    </Pressable>
  );
}

function createStyles(t: Theme) {
  const { colors, spacing, radius } = t;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, gap: spacing.md },
    profile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      padding: spacing.lg,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: colors.accentInk, fontSize: 20, fontWeight: '800' },
    name: { color: colors.ink, fontSize: 18, fontWeight: '800' },
    email: { color: colors.muted, fontSize: 13, marginTop: 2 },
    typeBadge: {
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
      backgroundColor: colors.bg,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      paddingVertical: 2,
      paddingHorizontal: spacing.md,
    },
    typeBadgeText: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
    sectionLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: spacing.sm },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
    signOutBtn: {
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    signOutText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
    version: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
  });
}
