import type { Shipment } from './shipment';

/** One week bucket in the forward schedule, CO₂e split by mode. */
export interface ScheduleWeek {
  weekStart: string; // YYYY-MM-DD (Monday)
  label: string; // e.g. "07 Jul"
  Ocean: number;
  Rail: number;
  Road: number;
  Air: number;
  count: number;
}

/** Forward-planning summary for a future window. */
export interface ScheduleSummary {
  window: { from: string; to: string };
  plannedCount: number;
  projectedCo2eTonnes: number;
  avoidableTonnes: number; // reduction reachable by planning the better route now
  airExposedCount: number;
  byWeek: ScheduleWeek[];
  shipments: Shipment[]; // the planned shipments, day-wise, sorted by date
}
