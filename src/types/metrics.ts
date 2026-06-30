import type { Intent } from './common';

export type MetricUnit = 'tonnes' | 'percent' | 'ratio' | 'number' | 'currency' | 'intensity' | 'index';

/** A single headline KPI tile. */
export interface KpiMetric {
  id: string;
  label: string;
  value: number;
  unit: MetricUnit;
  /** Pre-formatted display string, overrides `value`+`unit` when present. */
  display?: string;
  intent: Intent;
  hint?: string;
  /** Optional period-over-period delta, already scaled (e.g. -4.2 → "-4.2%"). */
  deltaPct?: number;
  /** Caption shown next to the delta pill, e.g. "vs 2025". */
  deltaLabel?: string;
  /** When true, a downward delta is the good (green) outcome — e.g. emissions. */
  betterWhenLower?: boolean;
  /** Semantic icon key resolved to a glyph by KpiCard (e.g. 'co2e', 'air', 'carrier'). */
  icon?: string;
}
