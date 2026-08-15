import { useColorScheme } from 'react-native';
import { palette, ColorTokens, spacing, radius, typography } from './tokens';

export interface Theme {
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  scheme: 'light' | 'dark';
}

/** Resolves the active palette from the OS scheme. Components never import a
 *  literal color — they call useTheme() so dark mode is automatic. */
export function useTheme(): Theme {
  const scheme = useColorScheme() ?? 'light';
  return {
    colors: scheme === 'dark' ? palette.dark : palette.light,
    spacing,
    radius,
    typography,
    scheme,
  };
}

export { palette, spacing, radius, typography };
export type { ColorTokens };
