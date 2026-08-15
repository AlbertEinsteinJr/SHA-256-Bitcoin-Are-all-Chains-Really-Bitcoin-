/**
 * Design tokens. Two palettes keyed by scheme; components read them through
 * useTheme() (src/theme/index.ts) so light/dark both resolve from one source.
 * Neutrals carry a slight cool bias toward the navy accent, not pure grey.
 */
export const palette = {
  light: {
    bg: '#F4F6F8',
    surface: '#FFFFFF',
    ink: '#12202E',
    muted: '#5B6B7A',
    line: '#D6DEE5',
    accent: '#0E4C92', // highway-sign navy
    accentInk: '#FFFFFF',
    safety: '#E8A317', // amber — "en route" / warning states
    good: '#2E7D46',
    danger: '#C0392B',
  },
  dark: {
    bg: '#0E1620',
    surface: '#16212E',
    ink: '#E7ECF1',
    muted: '#93A3B3',
    line: '#25323F',
    accent: '#5FA0E6',
    accentInk: '#08111A',
    safety: '#E8A317',
    good: '#6FBF87',
    danger: '#E4756A',
  },
} as const;

export type ColorTokens = (typeof palette)['light'];

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.3 },
  title: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.4 },
} as const;
