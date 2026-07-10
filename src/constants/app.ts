/** App-wide constants. APP_TODAY mirrors the generator's frozen as-of date. */
export const APP_TODAY = '2026-06-30';

/** Forward-planning window (days) for the Scheduler — matches the generator. */
export const PLAN_HORIZON_DAYS = 100;

/** Add days to a YYYY-MM-DD string (UTC), returning YYYY-MM-DD. */
export function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const APP_META = {
  name: 'Tradewind',
  tagline: 'Steer every shipment to its lowest-carbon lane.',
  company: 'Terova',
  scope: 'Scope 3 · Downstream Transportation',
  longName: 'Tradewind — Downstream Transportation Carbon Decisioning',
} as const;

/** Modes and their brand colours (used by charts, the map, and chips). */
export const MODE_COLORS: Record<string, string> = {
  Ocean: '#3b82f6',
  Rail: '#8b5cf6',
  Road: '#f59e0b',
  Air: '#f43f5e',
};

export const APPROACH_COLORS: Record<string, string> = {
  current: '#64748b',
  optimal: '#f43f5e',
  balanced: '#f59e0b',
  best_co2: '#10b981',
};

export const APPROACH_LABEL: Record<string, string> = {
  current: 'Current',
  optimal: 'Fastest',
  balanced: 'Balanced',
  best_co2: 'Best for CO₂',
};

/** Display labels for shipment status — data keeps 'Planned'; the UI says "To be planned". */
export const STATUS_LABEL: Record<string, string> = {
  Delivered: 'Delivered',
  'In transit': 'In transit',
  Planned: 'To be planned',
};
