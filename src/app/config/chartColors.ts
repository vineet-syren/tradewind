import { brandTokens } from './theme';
import { MODE_COLORS, OPTION_COLORS } from '@/constants/app';

/** Ordered categorical palette for charts. */
export const CHART_PALETTE = [
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
  '#64748b', // slate
  '#a78bfa', // lavender
];

export const SEVERITY_COLORS = {
  High: brandTokens.high,
  Medium: brandTokens.med,
  Low: brandTokens.low,
} as const;

export { MODE_COLORS, OPTION_COLORS };

export const chartColor = (i: number): string => CHART_PALETTE[i % CHART_PALETTE.length];
