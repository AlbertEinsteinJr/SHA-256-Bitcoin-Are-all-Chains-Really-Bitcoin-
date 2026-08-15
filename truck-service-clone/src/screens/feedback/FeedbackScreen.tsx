/**
 * FeedbackScreen (Root 'Feedback') — the in-app feedback channel.
 * Presented at the ROOT stack level (above the tabs) so it can be opened as a
 * modal from anywhere via getParent().navigate('Feedback'). Collects a category +
 * free-text message and POSTs it to endpoints.feedback through apiSend; on success
 * it confirms and dismisses back to wherever it was launched from.
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
import type { RootStackParamList } from '@/navigation/types';
import { apiSend } from '@services/apiClient';
import { endpoints } from '@config/endpoints';
import { useAuth } from '@hooks/useAuth';
import { useTheme, type Theme } from '@theme/index';

const CATEGORIES = [
  { key: 'listing', label: 'Wrong listing' },
  { key: 'bug', label: 'Something broke' },
  { key: 'feature', label: 'Feature idea' },
  { key: 'other', label: 'Other' },
] as const;
type CategoryKey = (typeof CATEGORIES)[number]['key'];

type Props = NativeStackScreenProps<RootStackParamList, 'Feedback'>;

export default function FeedbackScreen({ navigation }: Props) {
  const theme = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { user } = useAuth();

  const [category, setCategory] = useState<CategoryKey>('listing');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!message.trim()) {
      setError('Please add a short description so we can act on it.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await apiSend('post', endpoints.feedback, {
        category,
        message: message.trim(),
        email: user?.email,
        platform: 'mobile',
        appVersion: '1.0.0',
      });
      setSent(true);
    } catch {
      setError('Could not send right now. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <View style={s.doneWrap}>
        <Text style={s.doneIcon}>✓</Text>
        <Text style={s.doneTitle}>Thanks — got it</Text>
        <Text style={s.doneBody}>
          Your note is on its way to the team. We review every report to keep the
          directory accurate.
        </Text>
        <Pressable style={s.primaryBtn} onPress={() => navigation.goBack()}>
          <Text style={s.primaryBtnText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.heading}>Send feedback</Text>
      <Text style={s.subheading}>Tell us what is off or what you would like to see.</Text>

      <View style={s.chips}>
        {CATEGORIES.map((c) => {
          const active = category === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setCategory(c.key)}
              style={[
                s.chip,
                { borderColor: active ? theme.colors.accent : theme.colors.line },
                active && { backgroundColor: theme.colors.accent },
              ]}
            >
              <Text style={{ color: active ? theme.colors.accentInk : theme.colors.muted, fontWeight: '700', fontSize: 13 }}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        placeholder="What happened? Include a vendor name or location if relevant."
        placeholderTextColor={theme.colors.muted}
        value={message}
        onChangeText={setMessage}
        multiline
        style={s.input}
      />

      {error ? <Text style={s.error}>{error}</Text> : null}

      <Pressable style={[s.primaryBtn, sending && { opacity: 0.6 }]} onPress={submit} disabled={sending}>
        {sending ? (
          <ActivityIndicator color={theme.colors.accentInk} />
        ) : (
          <Text style={s.primaryBtnText}>Send feedback</Text>
        )}
      </Pressable>

      <Pressable style={s.cancel} onPress={() => navigation.goBack()}>
        <Text style={s.cancelText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(t: Theme) {
  const { colors, spacing, radius } = t;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, gap: spacing.md },
    heading: { fontSize: 24, fontWeight: '800', color: colors.ink },
    subheading: { fontSize: 14, color: colors.muted, marginTop: -spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      borderRadius: radius.md,
      padding: spacing.md,
      color: colors.ink,
      fontSize: 15,
      minHeight: 140,
      textAlignVertical: 'top',
    },
    error: { color: colors.danger, fontSize: 13, fontWeight: '600' },
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    primaryBtnText: { color: colors.accentInk, fontWeight: '700', fontSize: 16 },
    cancel: { alignItems: 'center', paddingVertical: spacing.sm },
    cancelText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
    doneWrap: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.md,
    },
    doneIcon: {
      fontSize: 30,
      color: colors.accentInk,
      backgroundColor: colors.good,
      width: 64,
      height: 64,
      borderRadius: 32,
      textAlign: 'center',
      lineHeight: 64,
      overflow: 'hidden',
    },
    doneTitle: { fontSize: 22, fontWeight: '800', color: colors.ink },
    doneBody: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  });
}
