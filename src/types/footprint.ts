import type { ModeLabel } from './common';
import type { Lane } from './lane';

export interface ModeSplitRow {
  mode: ModeLabel;
  co2eTonnes: number;
  pct: number;
  shipments: number;
}

export interface NamedShare {
  label: string;
  co2eTonnes: number;
  pct: number;
}

/** One reporting year as the workbook tabs define it (Jul → Jun). */
export interface ReportingYearPoint {
  reportingYear: string;
  co2eTonnes: number;
  weightTonnes: number;
  intensity: number;
  shipments: number;
}

/** Computed downstream-transportation footprint for the active scope. */
export interface Footprint {
  totalCo2eTonnes: number;
  /** The latest complete reporting year — the number to quote as "current". */
  latestYearCo2eTonnes: number;
  latestReportingYear: string;
  totalWeightTonnes: number;
  avgIntensity: number; // g CO₂e per tonne-kilometre
  shipmentCount: number;
  laneCount: number;
  modeSplit: ModeSplitRow[];
  byRegion: NamedShare[];
  byCategory: NamedShare[];
  byGateway: NamedShare[];
  byReportingYear: ReportingYearPoint[];
  /** CO₂e avoidable on workbook-evidenced options, across all shipments in scope. */
  avoidableTonnes: number;
  avoidablePct: number;
  /** Same, restricted to shipments still to be planned — the actionable number. */
  plannedAvoidableTonnes: number;
  plannedShipmentCount: number;
  /** Change in the latest year vs the year before (%), negative is a reduction. */
  yoyChangePct: number | null;
  airShipmentCount: number;
  airCo2eTonnes: number;
  /** Share of CO₂e from road legs — the part a gateway decision can move. */
  roadCo2eTonnes: number;
  topLanes: Lane[];
  /** Share of CO₂e from the top-3 destination ports (concentration). */
  top3DestSharePct: number;
}
