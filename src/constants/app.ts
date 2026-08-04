/**
 * App-wide constants.
 *
 * `APP_TODAY` is the day after the last dispatch date in the source workbook —
 * the app positions itself the morning after the data closes, so "still to be
 * planned" means exactly that. It must stay in step with `ASSUMPTIONS.asOf`
 * emitted by `scripts/generate-mock-data.mjs`.
 */
export const APP_TODAY = '2024-07-01';

/** Add days to a YYYY-MM-DD string (UTC), returning YYYY-MM-DD. */
export function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const APP_META = {
  name: 'Tradewind',
  tagline: 'Every route option, priced in carbon, from your own shipment records.',
  company: 'Terova',
  scope: 'Scope 3 · Downstream transportation',
  longName: 'Tradewind — Downstream Transportation Carbon Decisioning',
  /** Shown wherever the app needs to say where its numbers come from. */
  sourceLabel: 'Transport Downstream- V02.xlsx',
} as const;

/** Modes and their brand colours (used by charts, the map, and chips). */
export const MODE_COLORS: Record<string, string> = {
  Ocean: '#3b82f6',
  Rail: '#8b5cf6',
  Road: '#f59e0b',
  Air: '#f43f5e',
};

/** Route-option colours — current is neutral, alternatives are shades of green. */
export const OPTION_COLORS: Record<string, string> = {
  current: '#64748b',
  'gateway-swap': '#10b981',
  'shorter-sea': '#0ea5e9',
  'sea-instead-of-air': '#059669',
  consolidate: '#14b8a6',
};

/** Display labels for shipment status — data keeps 'Planned'; the UI spells it out. */
export const STATUS_LABEL: Record<string, string> = {
  Delivered: 'Shipped',
  Planned: 'To be planned',
};
