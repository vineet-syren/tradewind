import { brandTokens } from './theme';
import { MODE_COLORS, APPROACH_COLORS } from '@/constants/app';

/** Ordered categorical palette for charts. */
export const CHART_PALETTE = [
  brandTokens.teal,
  '#1E6E8C',
  '#7A5AA0',
  brandTokens.med,
  '#3F8F7A',
  '#C0392B',
  '#4C7FB0',
  '#9C6B3E',
  '#2E8B6F',
  '#8E7CC3',
];

export const SEVERITY_COLORS = {
  High: brandTokens.high,
  Medium: brandTokens.med,
  Low: brandTokens.low,
} as const;

export { MODE_COLORS, APPROACH_COLORS };

export const chartColor = (i: number): string => CHART_PALETTE[i % CHART_PALETTE.length];
