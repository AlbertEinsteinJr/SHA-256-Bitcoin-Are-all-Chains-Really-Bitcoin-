/**
 * RatingStars — the star row reused everywhere a Rating surfaces.
 * ROLE: a single presentational primitive that renders in two modes from one prop
 * shape: read-only (no `onChange`) for vendor cards/detail headers, and interactive
 * (with `onChange`) for the "rate this shop" composer. Uses ★/☆ glyphs so it needs
 * no image assets, and pulls every color from useTheme() for automatic dark mode.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@theme/index';

export function RatingStars({
  value,
  size,
  onChange,
}: {
  value: number;
  size?: number;
  onChange?: (stars: number) => void;
}) {
  const { colors } = useTheme();
  const glyphSize = size ?? 16;
  const interactive = typeof onChange === 'function';

  // Read-only stars support half-values (e.g. a 4.3 average); the interactive
  // composer only ever emits whole 1–5 selections.
  const rounded = interactive ? Math.round(value) : Math.round(value * 2) / 2;

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center' }}
      accessibilityRole={interactive ? 'adjustable' : 'image'}
      accessibilityLabel={`${value.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = rounded >= star;
        const half = !filled && rounded >= star - 0.5;
        const starEl = (
          <Text
            style={{
              fontSize: glyphSize,
              lineHeight: glyphSize * 1.2,
              color: filled || half ? colors.safety : colors.line,
            }}
          >
            {filled || half ? '★' : '☆'}
          </Text>
        );

        if (!interactive) {
          return (
            <View key={star} style={{ marginRight: 1 }}>
              {starEl}
            </View>
          );
        }

        return (
          <Pressable
            key={star}
            onPress={() => onChange!(star)}
            hitSlop={6}
            style={{ paddingHorizontal: 2 }}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${star} star${star === 1 ? '' : 's'}`}
          >
            {starEl}
          </Pressable>
        );
      })}
    </View>
  );
}
