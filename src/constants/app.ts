/** App-wide constants. APP_TODAY mirrors the generator's frozen as-of date. */
export const APP_TODAY = '2025-01-08';

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

export const APPROACH_COLORS: Record<string, string> = {
  current: '#6B7384',
  optimal: '#C0392B',
  balanced: '#C8841B',
  best_co2: '#0C8B7B',
};

export const APPROACH_LABEL: Record<string, string> = {
  current: 'Current',
  optimal: 'Optimal',
  balanced: 'Balanced',
  best_co2: 'Best for CO₂',
};
