/**
 * Brand theme — the single source of brand/foundation tokens for Tradewind.
 *
 * Palette: clean analytics chrome — Inter on white cards over a soft gray
 * canvas, indigo as the single decisioning accent, emerald/amber/rose as
 * semantic outcome colours. Feature components consume the MUI theme +
 * semantic tokens, never raw hex.
 */
import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';

export const brandTokens = {
  // Indigo primary (AI/decisioning accent) on a light, neutral chrome.
  indigo: '#4f46e5',
  indigoDark: '#4338ca',
  indigoLight: '#6366f1',
  indigoSoft: '#eef2ff',
  teal: '#10b981',
  tealLight: '#34d399',
  navy: '#111827',
  navy2: '#1f2937',
  cream: '#f9fafb',
  paper: '#FFFFFF',
  ink: '#111827',
  muted: '#6b7280',
  line: '#e5e7eb',
  // Light sidebar.
  sidebarBg: '#FFFFFF',
  sidebarText: '#374151',
  sidebarMuted: '#9ca3af',
  sidebarActive: '#eef2ff',
  sidebarActiveText: '#4338ca',
  // Semantic severity (high = bad, low = good).
  high: '#ef4444',
  med: '#f59e0b',
  low: '#10b981',
  radius: 10,
  fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as const;

const lightPalette: ThemeOptions['palette'] = {
  mode: 'light',
  primary: { main: brandTokens.indigo, dark: brandTokens.indigoDark, light: brandTokens.indigoLight },
  secondary: { main: brandTokens.navy, light: brandTokens.navy2 },
  success: { main: brandTokens.low },
  warning: { main: brandTokens.med },
  error: { main: brandTokens.high },
  info: { main: '#3b82f6' },
  background: { default: brandTokens.cream, paper: brandTokens.paper },
  text: { primary: brandTokens.ink, secondary: brandTokens.muted },
  divider: brandTokens.line,
};

const darkPalette: ThemeOptions['palette'] = {
  mode: 'dark',
  primary: { main: '#818cf8', dark: brandTokens.indigo, light: '#a5b4fc' },
  secondary: { main: '#94a3b8' },
  success: { main: '#34d399' },
  warning: { main: '#fbbf24' },
  error: { main: '#f87171' },
  info: { main: '#60a5fa' },
  background: { default: '#0f172a', paper: '#1e293b' },
  text: { primary: '#f1f5f9', secondary: '#94a3b8' },
  divider: 'rgba(241, 245, 249, 0.12)',
};

export function createAppTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark';
  return createTheme({
    palette: isDark ? darkPalette : lightPalette,
    shape: { borderRadius: brandTokens.radius },
    typography: {
      fontFamily: brandTokens.fontFamily,
      // Global size bump — MUI scales every rem-based variant from this base (default 14).
      fontSize: 15.5,
      fontWeightLight: 300,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.02em' },
      h6: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
      overline: { letterSpacing: '0.12em', fontWeight: 600 },
    },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${isDark ? 'rgba(241,245,249,0.10)' : brandTokens.line}`,
            borderRadius: brandTokens.radius + 2,
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.06)',
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
            fontSize: 12,
          },
        },
      },
    },
  });
}
