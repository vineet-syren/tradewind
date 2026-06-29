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

/** Computed downstream-transportation footprint for the active scope. */
export interface Footprint {
  totalCo2eTonnes: number;
  annualCo2eTonnes: number;
  totalWeightTonnes: number;
  avgIntensity: number; // t CO₂e per tonne shipped
  shipmentCount: number;
  laneCount: number;
  modeSplit: ModeSplitRow[];
  byRegion: NamedShare[];
  reductionOpportunityTonnes: number; // realizable
  reductionOpportunityPct: number;
  theoreticalReductionTonnes: number;
  realizedReductionPct: number;
  ambitionPct: number;
  airExceptionCount: number;
  airAvoidableCount: number;
  airCo2eTonnes: number;
  /** Shipments currently in transit or planned (2026 live decisioning). */
  liveShipmentCount: number;
  topLanes: Lane[];
  /** Share of CO₂e from the top-5 customers (concentration). */
  top5CustomerSharePct: number;
}
