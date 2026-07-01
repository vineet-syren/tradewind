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
  Ocean: '#1E6E8C',
  Rail: '#7A5AA0',
  Road: '#C8841B',
  Air: '#C0392B',
};

/** GHG Protocol scope colours — distinct hues that still sit within the indigo chrome. */
export const SCOPE_COLORS: Record<string, string> = {
  scope1: '#E7A93B', // direct combustion / fleet — amber
  scope2: '#2FB8A6', // purchased energy — teal
  scope3: '#5B57E0', // value chain — indigo (dominant)
};

export const SCOPE_SHORT: Record<string, string> = {
  scope1: 'Scope 1',
  scope2: 'Scope 2',
  scope3: 'Scope 3',
};

export const APPROACH_COLORS: Record<string, string> = {
  current: '#6B7384',
  optimal: '#C0392B',
  balanced: '#C8841B',
  best_co2: '#0C8B7B',
};

export const APPROACH_LABEL: Record<string, string> = {
  current: 'Current',
  optimal: 'Fastest',
  balanced: 'Balanced',
  best_co2: 'Best for CO₂',
};
