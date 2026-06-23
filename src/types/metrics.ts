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
}
