/** Display formatting helpers (presentation only — no business logic). */

import type { MetricUnit } from '@/types';

const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** Compact tonnes CO₂e: 12.3k t, 480 t, 6.2 t. */
export function formatTonnes(value: number, dp = 1): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M t`;
  if (abs >= 10_000) return `${(value / 1000).toFixed(1)}k t`;
  if (abs >= 100) return `${Math.round(value)} t`;
  return `${value.toFixed(dp)} t`;
}

export function formatTonnesFull(value: number): string {
  return `${numberFmt.format(Math.round(value))} t`;
}

export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(value / 1000)}K`;
  return currencyFmt.format(value);
}

/** Signed compact currency: +$2.4K / −$1.1K. */
export function formatSignedCurrency(value: number): string {
  if (value === 0) return '$0';
  const sign = value > 0 ? '+' : '−';
  return `${sign}${formatCurrency(Math.abs(value))}`;
}

export function formatNumber(value: number): string {
  return numberFmt.format(value);
}

export function formatDistance(km: number): string {
  return `${numberFmt.format(Math.round(km))} km`;
}

export function formatPercent(value: number, dp = 1): string {
  return `${value.toFixed(dp)}%`;
}

export function formatSignedPercent(value: number, dp = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(dp)}%`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function formatRelative(iso: string, nowIso?: string): string {
  const then = new Date(iso).getTime();
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const diffH = Math.round((now - then) / 3_600_000);
  if (diffH < 1) return 'just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  return diffD <= 1 ? 'yesterday' : `${diffD}d ago`;
}

export function formatMetric(value: number, unit: MetricUnit): string {
  switch (unit) {
    case 'tonnes':
      return formatTonnes(value);
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value, value % 1 === 0 ? 0 : 1);
    case 'intensity':
      return `${value.toFixed(3)} t/t`;
    case 'ratio':
      return `${value.toFixed(2)}×`;
    case 'index':
      return value.toFixed(2);
    case 'number':
    default:
      return formatNumber(value);
  }
}
