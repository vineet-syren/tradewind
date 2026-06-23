/**
 * Brand theme — the single source of brand/foundation tokens for Tradewind.
 *
 * Palette: deep teal-green (decarbonization) on warm cream with ocean navy —
 * distinct from the reference app's coral, fitting a carbon/ocean product.
 * Feature components consume the MUI theme + semantic tokens, never raw hex.
 */
import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';

export const brandTokens = {
  teal: '#0C8B7B',
  tealDark: '#0A6E62',
  tealLight: '#2FB8A6',
  tealSoft: '#E1F3EF',
  navy: '#0B1F2A',
  navy2: '#12303E',
  cream: '#F7FAF9',
  paper: '#FFFFFF',
  ink: '#0B1F2A',
  muted: '#5C6B72',
  line: '#E6ECEA',
  sidebarBg: '#0B1F2A',
  sidebarText: '#C3D2D0',
  sidebarMuted: '#6E8480',
  // Semantic severity (high = bad, low = good).
  high: '#C0392B',
  med: '#C8841B',
  low: '#2E8B6F',
  radius: 13,
  fontFamily: '"Montserrat", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as const;

const lightPalette: ThemeOptions['palette'] = {
  mode: 'light',
  primary: { main: brandTokens.teal, dark: brandTokens.tealDark, light: brandTokens.tealLight },
  secondary: { main: brandTokens.navy, light: brandTokens.navy2 },
  success: { main: brandTokens.low },
  warning: { main: brandTokens.med },
  error: { main: brandTokens.high },
  info: { main: '#1E6E8C' },
  background: { default: brandTokens.cream, paper: brandTokens.paper },
  text: { primary: brandTokens.ink, secondary: brandTokens.muted },
  divider: brandTokens.line,
};

const darkPalette: ThemeOptions['palette'] = {
  mode: 'dark',
  primary: { main: '#2FB8A6', dark: brandTokens.teal, light: '#54D0BE' },
  secondary: { main: '#9FB8C0' },
  success: { main: '#4CAF82' },
  warning: { main: '#E0A33A' },
  error: { main: '#E26A5A' },
  info: { main: '#5BA9C2' },
  background: { default: '#091620', paper: '#0F2531' },
  text: { primary: '#EAF1F0', secondary: '#9DB0B2' },
  divider: 'rgba(234, 241, 240, 0.12)',
};

export function createAppTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark';
  return createTheme({
    palette: isDark ? darkPalette : lightPalette,
    shape: { borderRadius: brandTokens.radius },
    typography: {
      fontFamily: brandTokens.fontFamily,
      fontWeightLight: 300,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      h4: { fontWeight: 500, letterSpacing: '-0.01em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 500 },
      overline: { letterSpacing: '0.14em', fontWeight: 600 },
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${isDark ? 'rgba(234,241,240,0.10)' : brandTokens.line}`,
            borderRadius: brandTokens.radius + 3,
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(11,31,42,.04), 0 8px 28px rgba(11,31,42,.05)',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: brandTokens.radius - 2 } },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 600,
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: 10.5,
          },
        },
      },
    },
  });
}
